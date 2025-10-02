/**
 * Purpose: parse NWC URI and probe wallet capabilities via NIP‑47 "info" (kind 13194).
 * Called by: NWC onboarding verification.
 */
import { SimplePool } from 'nostr-tools';
import { logger } from './logger';

export async function parseNwcUri(uri: string) {
  const u = new URL(String(uri).replace('nostr+walletconnect://', 'http://'));
  const walletPubkey = u.hostname;
  const relayUrl = u.searchParams.get('relay') || '';
  return { walletPubkey, relayUrl };
}

export async function fetchInfoEvent(walletPubkey: string, relayUrl: string) {
  if (!relayUrl) return null;

  const pool = new SimplePool();
  const relays = [relayUrl];
  const evt = await new Promise<any | null>((resolve) => {
    let done = false;
    const subscription = pool.subscribeMany(relays, { kinds: [13194], authors: [walletPubkey], limit: 1 }, {
      onevent: (ev: any) => { 
        if (!done) { 
          done = true; 
          resolve(ev); 
          subscription.close(); 
        } 
      }
    });
    setTimeout(() => { 
      if (!done) { 
        done = true; 
        resolve(null); 
        subscription.close(); 
      } 
    }, 5000);
  });
  pool.close(relays);
  if (!evt) return null;

  const methods = new Set((evt.content || '').trim().split(/\s+/));
  const encTag = evt.tags.find((t: any) => t[0] === 'encryption');
  const notificationsTag = evt.tags.find((t: any) => t[0] === 'notifications');
  const encryptionMode = encTag?.[1]?.includes('nip44') ? 'nip44_v2' : (encTag?.[1]?.includes('nip04') ? 'nip04' : null);
  const notificationKinds = notificationsTag?.[1] || '23197 23196';

  // Check for dangerous write operations
  const writeMethods = ['pay_invoice', 'multi_pay_invoice', 'pay_keysend', 'multi_pay_keysend'];
  const hasWriteCapabilities = writeMethods.some(m => methods.has(m));
  const detectedWriteMethods = writeMethods.filter(m => methods.has(m));

  if (hasWriteCapabilities) {
    logger.warn({
      msg: 'NWC info event contains write capabilities',
      walletPubkey,
      detectedWriteMethods,
      allMethods: Array.from(methods)
    });
  } else {
    logger.info({
      msg: 'NWC info event is read-only',
      walletPubkey,
      allMethods: Array.from(methods)
    });
  }

  return {
    methods,
    encryptionMode,
    notificationKinds,
    supportsMakeInvoice: methods.has('make_invoice'),
    supportsLookup: methods.has('lookup_invoice'),
    supportsNotifications: methods.has('notifications'),
    hasWriteCapabilities,
    detectedWriteMethods
  };
}