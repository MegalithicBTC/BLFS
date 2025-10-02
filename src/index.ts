/**
 * Purpose: bootstrap Express, mount controllers, start background workers.
 * Called by: container CMD (ts-node ./src/index.ts).
 * Sequence: DB init → mount /webhooks (raw) → JSON/form routes → start notifications + poller.
 */
import 'reflect-metadata';
import path from 'path';
import express, { json, urlencoded } from 'express';
import { AppDataSource } from './store/data-source';
import { BaseEntity } from 'typeorm';
import { httpLogger, logger } from './util/logger';
import { router as dev } from './web/dev';
import { router as checkout } from './web/checkout';
import { router as webhooks } from './web/webhooks';
import { router as merchant } from './web/merchant';
import { router as pay } from './web/pay';
import { startAllNotificationListeners, stopAllNotificationListeners } from './util/notifications';
import { startInvoicePoller, stopInvoicePoller } from './util/poller';

// Filter out noisy NIP-04 deprecation warnings from nostr-tools
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = args.join(' ');
  if (message.includes('NIP-04 encryption is about to be deprecated')) {
    return; // Silently ignore this warning
  }
  originalWarn.apply(console, args);
};

async function main() {
  await AppDataSource.initialize();
  BaseEntity.useDataSource(AppDataSource);

  const app = express();
  app.set('views', path.join(process.cwd(), 'src', 'views'));
  app.set('view engine', 'ejs');

  app.get('/health', (_req, res) => res.status(200).send('ok'));
  app.use(httpLogger);

  // Webhooks must see raw body; mounted before JSON parsers.
  app.use('/webhooks', webhooks);

  app.use(json());
  app.use(urlencoded({ extended: false }));

  // Developer setup UI.
  app.use(dev);

  // Public JSON used by hosted invoice page or any storefront JS.
  app.use(checkout);

  // Merchant read-only portal.
  app.use(merchant);

  // Hosted invoice page.
  app.use(pay);

  // Home page
  app.get('/', (req, res) => {
    res.render('home');
  });

  app.use('/static', express.static(path.join(process.cwd(), 'src', 'public')));

  const host = process.env.APP_HOST || '127.0.0.1';
  const port = Number(process.env.APP_PORT || 8080);
  const server = app.listen(port, host, () => logger.info({ msg: 'listening', host, port }));

  // Background workers: Nostr notifications + stepped polling.
  startAllNotificationListeners();
  startInvoicePoller();

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info({ msg: 'shutdown signal received', signal });
    
    // Force exit after 500ms if graceful shutdown hangs
    const forceTimeout = setTimeout(() => {
      logger.warn({ msg: 'forced shutdown after timeout' });
      process.exit(0);
    }, 500);
    
    // Stop background workers immediately
    stopInvoicePoller();
    stopAllNotificationListeners();
    
    // Close HTTP server (stop accepting new connections)
    server.close(() => {
      logger.info({ msg: 'http server closed' });
    });
    
    // Close database connections
    try {
      await AppDataSource.destroy();
      logger.info({ msg: 'database connections closed' });
      clearTimeout(forceTimeout);
      process.exit(0);
    } catch (err) {
      logger.error({ msg: 'error closing database', error: err });
      clearTimeout(forceTimeout);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGQUIT', () => {
    logger.warn({ msg: 'SIGQUIT received - forcing immediate exit' });
    process.exit(0);
  });
}
main().catch(err => { console.error(err); process.exit(1); });
