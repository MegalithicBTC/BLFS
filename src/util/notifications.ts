/**
 * Purpose: subscribe to wallet notification kinds; settle matching orders ASAP.
 * Called by: app entry (startAllNotificationListeners) and dev verify (startListenerForWallet on activation).
 */
import { WalletConnection } from '../store/entities/WalletConnection';
import { Order } from '../store/entities/Order';
import { lookupInvoiceAndSettle } from './invoices';
import { logger } from './logger';
import { SimplePool } from 'nostr-tools';
import { parseNwcUri } from './nip47';
import { decryptString } from './crypto';

const activeSubscriptions: any[] = [];
const activePools: SimplePool[] = [];

export async function startAllNotificationListeners() {
  try {
    const wallets = await WalletConnection.find({ relations: ['shop'] });
    for (const wc of wallets) {
      if (!wc.shop) {
        logger.error({ msg: 'notify.wallet.no-shop', walletId: wc.id });
        continue;
      }
      startListenerForWallet(wc).catch(err => logger.error({ msg: 'notify.start.error', err: String(err), shop: wc.shop.domain }));
    }
  } catch (e: any) {
    logger.error({ msg: 'notify.startAll.error', err: String(e) });
  }
}

export function stopAllNotificationListeners() {
  logger.info({ msg: 'stopping notification listeners', count: activeSubscriptions.length });
  
  for (const sub of activeSubscriptions) {
    try {
      sub.close();
    } catch (e) {
      logger.warn({ msg: 'error closing subscription', err: String(e) });
    }
  }
  activeSubscriptions.length = 0;
  
  for (const pool of activePools) {
    try {
      // SimplePool doesn't have a close method, connections will clean up on their own
      // But we can at least clear our reference
    } catch (e) {
      logger.warn({ msg: 'error closing pool', err: String(e) });
    }
  }
  activePools.length = 0;
  
  logger.info({ msg: 'notification listeners stopped' });
}

export async function startListenerForWallet(wc: WalletConnection) {
  // Decrypt the NWC URI before parsing
  const decryptedUri = decryptString(wc.nwcUri);
  if (!decryptedUri) {
    logger.error('Failed to decrypt NWC URI');
    return;
  }

  // Extract relay URL from NWC URI
  const { relayUrl } = await parseNwcUri(decryptedUri);

  if (!relayUrl) {
    logger.warn('No relay URL found in NWC URI, skipping notifications');
    return;
  }

  const relays = [relayUrl];
  const kinds = [23197, 23196]; // Notification event kinds (23197=nip44, 23196=nip04)
  const pool = new SimplePool();
  activePools.push(pool);
  
  const subscription = pool.subscribeMany(relays, { kinds, authors: [wc.walletPubkey] }, {
    onevent: async (ev: any) => {
      try {
        // The @getalby/sdk's NWCClient should be used to properly decrypt notifications,
        // but for now we'll try to extract payment info from the encrypted content
        // This is a fallback that may work if the notification includes plaintext hints
        const text = ev.content || '';
        const hash = (text.match(/[a-f0-9]{64}/i) || [])[0];
        const inv = (text.match(/lnbc[0-9a-z]+/i) || [])[0];
        
        logger.info({
          msg: 'notification.received',
          walletPubkey: wc.walletPubkey,
          eventKind: ev.kind,
          encryptedContent: text.substring(0, 100) + '...',
          foundHash: hash || null,
          foundInvoice: inv || null
        });
        
        // TODO: Properly decrypt notification using NWCClient when SDK supports it
        // For now, we rely on polling which works reliably
        
        if (!hash && !inv) {
          logger.warn({
            msg: 'notification.no-identifiers',
            note: 'Unable to extract payment_hash or invoice from notification. Relying on polling.'
          });
          return;
        }

        let order: Order | null = null;
        if (hash) order = await Order.findOne({ where: { paymentHash: hash } as any, relations: ['shop'] });
        if (!order && inv) order = await Order.findOne({ where: { bolt11: inv } as any, relations: ['shop'] });
        
        if (!order) {
          logger.warn({
            msg: 'notification.order.not-found',
            hash: hash || null,
            invoice: inv || null
          });
          return;
        }

        if (!order.shop) {
          logger.error({ msg: 'notify.order.no-shop', orderId: order.id });
          return;
        }

        logger.info({
          msg: 'notification.order.found',
          orderId: order.id,
          invoiceRef: order.invoiceRef,
          statusBefore: order.status
        });

        await lookupInvoiceAndSettle(order, order.shop, wc);
        
        logger.info({
          msg: 'notification.order.settled',
          orderId: order.id,
          statusAfter: order.status
        });
      } catch (e: any) {
        logger.error({ msg: 'notify.event.error', err: String(e) });
      }
    }
  });
  
  activeSubscriptions.push(subscription);
}