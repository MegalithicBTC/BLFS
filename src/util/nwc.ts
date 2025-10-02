import { NWCClient } from '@getalby/sdk';
import { logger } from './logger';

/**
 * Purpose: wrap @getalby/sdk for invoice create + lookup via NIP‑47.
 * Called by: invoices.ts.
 */
export async function nwcMakeInvoiceMsat(nwcUri: string, msat: bigint, memo?: string) {
  const client = new NWCClient({ nostrWalletConnectUrl: nwcUri });
  
  try {
    const transaction = await client.makeInvoice({
      amount: Number(msat), // amount in millisats
      description: memo,
    });
    
    const bolt11: string = transaction.invoice;
    const paymentHash: string | null = transaction.payment_hash || null;
    return { bolt11, paymentHash };
  } finally {
    client.close();
  }
}

export async function nwcLookupInvoice(nwcUri: string, args: { invoice?: string; payment_hash?: string }) {
  const client = new NWCClient({ nostrWalletConnectUrl: nwcUri });
  
  try {
    const transaction = await client.lookupInvoice(args);
    
    return transaction;
  } catch (error) {
    logger.error({
      msg: 'nwc.lookup.error',
      error: String(error),
      errorType: error?.constructor?.name,
      hasInvoice: !!args.invoice,
      hasPaymentHash: !!args.payment_hash
    });
    throw error;
  } finally {
    client.close();
  }
}