/**
 * Purpose: background worker to poll lookup_invoice with stepped cadence until paid/expired.
 * Called by: app entry on startup. Complements notifications to handle missed events.
 */
import { Order } from '../store/entities/Order';
import { WalletConnection } from '../store/entities/WalletConnection';
import { Shop } from '../store/entities/Shop';
import { lookupInvoiceAndSettle } from './invoices';
import { logger } from './logger';
import { orderCancel } from './shopify';

const TICK_MS = 2000;
function nextDelayMs(elapsedMs: number): number {
  if (elapsedMs < 2 * 60 * 1000) return 3000;
  if (elapsedMs < 5 * 60 * 1000) return 6000;
  return 12000;
}

let pollerTimer: NodeJS.Timeout | null = null;
let pollerStopping = false;

export async function startInvoicePoller() {
  pollerStopping = false;
  
  async function tick() {
    if (pollerStopping) return;
    
    try {
      const now = new Date();
      const pending = await Order.createQueryBuilder('o')
        .leftJoinAndSelect('o.shop', 'shop')
        .where('o.status = :s', { s: 'awaiting_payment' })
        .andWhere('o.bolt11 IS NOT NULL AND o.bolt11 != :empty', { empty: '' })
        .andWhere('o.nextPollAt IS NOT NULL AND o.nextPollAt <= :now', { now })
        .getMany();

      for (const o of pending) {
        if (pollerStopping) break;
        
        try {
          if (!o.shop) {
            logger.error({ msg: 'poller.order.no-shop', orderId: o.id });
            continue;
          }

          if (o.expiresAt && o.expiresAt <= now) {
            o.status = 'failed';
            o.nextPollAt = null;
            await o.save();
            if (o.shop.shopifyAccessToken && o.orderGid) {
              try { await orderCancel(o.shop, o.orderGid); } catch (e) { logger.warn({ msg: 'shopify.cancel.failed', orderId: o.id, err: String(e) }); }
            }
            continue;
          }

          const wallet = await WalletConnection.findOne({ where: { shop: { id: o.shop.id } } as any });
          if (!wallet) continue;

          // Only log on first attempt and every 10th attempt to reduce verbosity
          if (o.pollAttempts === 0 || (o.pollAttempts || 0) % 10 === 0) {
            logger.info({
              msg: 'poller.checking',
              orderId: o.id,
              attempt: (o.pollAttempts || 0) + 1
            });
          }

          await lookupInvoiceAndSettle(o, o.shop, wallet);

          // Only log if status changed
          if (o.status !== 'awaiting_payment') {
            logger.info({
              msg: 'poller.settled',
              orderId: o.id,
              status: o.status,
              attempts: o.pollAttempts || 0
            });
          }

          if (o.status === 'awaiting_payment') {
            const elapsed = Date.now() - o.createdAt.getTime();
            o.nextPollAt = new Date(Date.now() + nextDelayMs(elapsed));
            o.pollAttempts = (o.pollAttempts || 0) + 1;
            await o.save();
          } else {
            o.nextPollAt = null;
            await o.save();
          }
        } catch (e: any) {
          logger.error({ msg: 'poller.order.error', orderId: o.id, err: String(e) });
          o.nextPollAt = new Date(Date.now() + 15000);
          await o.save();
        }
      }
    } catch (e: any) {
      logger.error({ msg: 'poller.tick.error', err: String(e) });
    } finally {
      if (!pollerStopping) {
        pollerTimer = setTimeout(tick, TICK_MS);
      }
    }
  }
  pollerTimer = setTimeout(tick, TICK_MS);
}

export function stopInvoicePoller() {
  pollerStopping = true;
  if (pollerTimer) {
    clearTimeout(pollerTimer);
    pollerTimer = null;
  }
  logger.info({ msg: 'poller stopped' });
}