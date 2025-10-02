/**
 * Purpose: register NWC URI and verify capabilities via info event; only allow creation if all required capabilities are present.
 * Called by: dev.ts via POST /dev/.../nwc/register.
 */
import { WalletConnection } from '../store/entities/WalletConnection';
import { parseNwcUri, fetchInfoEvent } from './nip47';
import { encryptString } from './crypto';
import { logger } from './logger';

export async function registerNwc(shopId: string, nwcUri: string) {
  const { walletPubkey, relayUrl } = await parseNwcUri(nwcUri);
  
  if (!relayUrl) {
    throw new Error('NWC URI must include a relay URL');
  }

  // Verify capabilities before creating the wallet connection
  const info = await fetchInfoEvent(walletPubkey, relayUrl);
  if (!info) {
    throw new Error('Could not fetch wallet capabilities. Please check the NWC URI and try again.');
  }

  // Check for required capabilities
  const missing: string[] = [];
  if (!info.supportsMakeInvoice) missing.push('make_invoice');
  if (!info.supportsLookup) missing.push('lookup_invoice');
  if (!info.supportsNotifications) missing.push('notifications');

  if (missing.length > 0) {
    throw new Error(`Your wallet does not support the required capabilities: ${missing.join(', ')}. Please use a wallet that supports all required NWC methods.`);
  }

  // Get or create wallet connection
  let wc = await WalletConnection.findOne({ where: { shop: { id: shopId } as any } });
  if (!wc) wc = WalletConnection.create({ shop: { id: shopId } as any } as any);
  
  wc!.nwcUri = encryptString(nwcUri)!;
  wc!.walletPubkey = walletPubkey;
  wc!.infoLastCheckedAt = new Date();

  // CRITICAL: Check that wallet is READ-ONLY (does not support payment operations)
  if (info.hasWriteCapabilities) {
    logger.error({
      msg: 'NWC wallet failed read-only validation',
      shopId,
      walletPubkey,
      detectedWriteMethods: info.detectedWriteMethods,
      allMethods: Array.from(info.methods)
    });
    
    // Save the wallet connection marked as failed
    wc!.failedReadOnlyValidation = true;
    await wc!.save();
    
    throw new Error(`SECURITY ERROR: This NWC wallet supports write operations (${info.detectedWriteMethods.join(', ')}). For security, you must use a READ-ONLY wallet that only supports make_invoice, lookup_invoice, and notifications. Please create a new NWC connection with read-only permissions.`);
  }
  
  logger.info({
    msg: 'NWC wallet passed read-only validation',
    shopId,
    walletPubkey,
    supportedMethods: Array.from(info.methods)
  });

  // All capabilities are present and wallet is read-only
  wc!.failedReadOnlyValidation = false; // Passed validation
  await wc!.save();
  
  return wc;
}