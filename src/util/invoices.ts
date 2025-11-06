/**
 * Purpose: core business logic: create invoice, persist order, settle via lookup.
 * Called by: checkout controller; pay page; poller.
 * Enforces capabilities: make_invoice + lookup_invoice + notifications must be present.
 * Memo: build ≤100-char "Shopify … — …".
 */
import { v4 as uuid } from 'uuid';
import { Shop } from '../store/entities/Shop';
import { WalletConnection } from '../store/entities/WalletConnection';
import { Order } from '../store/entities/Order';
import { fiatToMsat, btcPrice } from './rates';
import { decryptString } from './crypto';
import { nwcMakeInvoiceMsat, nwcLookupInvoice } from './nwc';
import { orderMarkAsPaid } from './shopify';
import { buildBolt11Memo } from './summary';
import { logger } from './logger';

// const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const INVOICE_IS_GOOD_FOR_MS = 10 * 60 * 1000; // 10 minutes

export async function createInvoiceForCheckout(params: {
  shop: Shop;
  wallet: WalletConnection;
  amount: number;
  currency?: string;
  checkoutToken?: string | null;
  orderGid?: string | null;
  orderName?: string | null;
  desc?: string | null;
  existingOrder?: Order | null;
}) {
  const { shop, wallet, amount, currency, checkoutToken, orderGid, orderName, desc, existingOrder } = params;

  const rate = await btcPrice(currency);
  const rawMsat = await fiatToMsat(amount, currency);
  // Round up to next whole sat (multiple of 1000 msats) to avoid Alby display bug
  // while remaining 100% NIP-47 compliant
  const msatRounded = ((rawMsat + 999n) / 1000n) * 1000n; // ceil to next 1000 msats
  const msat = msatRounded === 0n ? 1000n : msatRounded;   // ensure ≥ 1 sat

  const memo = buildBolt11Memo({
    orderName: orderName || undefined,
    desc: desc || undefined,
    amount,
    currency: currency || process.env.CURRENCY || 'USD'
  });

  const { bolt11, paymentHash } = await nwcMakeInvoiceMsat(decryptString(wallet.nwcUri)!, msat, memo);

  const now = Date.now();
  
  let order: Order;
  if (existingOrder) {
    // Update existing order with invoice details
    existingOrder.checkoutToken = checkoutToken || existingOrder.checkoutToken;
    existingOrder.invoiceRef = uuid();
    existingOrder.msat = msat.toString();
    existingOrder.bolt11 = bolt11;
    existingOrder.paymentHash = paymentHash || null;
    existingOrder.bolt11Memo = memo;
    existingOrder.exchangeRateUsed = rate;
    existingOrder.expiresAt = new Date(now + INVOICE_IS_GOOD_FOR_MS);
    existingOrder.nextPollAt = new Date(now + 3000);
    existingOrder.pollAttempts = 0;
    // orderSummary already set by webhook - don't overwrite it
    await existingOrder.save();
    order = existingOrder;
  } else {
    // Create new order
    order = Order.create({
      shop,
      orderGid: orderGid || null,
      checkoutToken: checkoutToken || null,
      invoiceRef: uuid(),
      presentmentCurrency: (currency || process.env.CURRENCY || 'USD').toUpperCase(),
      amountPresentment: amount,
      msat: msat.toString(),
      status: 'awaiting_payment',
      bolt11,
      paymentHash: paymentHash || null,
      preimage: null,
      shopifyOrderName: orderName || null,
      orderSummary: desc || null,
      bolt11Memo: memo,
      paidAt: null,
      exchangeRateUsed: rate,
      expiresAt: new Date(now + INVOICE_IS_GOOD_FOR_MS),
      nextPollAt: new Date(now + 3000),
      pollAttempts: 0
    });
    await order.save();
  }

  return { order, bolt11, paymentHash: order.paymentHash, invoiceRef: order.invoiceRef };
}

export async function lookupInvoiceAndSettle(order: Order, shop: Shop, wallet: WalletConnection) {
  if (order.status !== 'awaiting_payment') return order;
  const creds = decryptString(wallet.nwcUri)!;
  const resp: any = await nwcLookupInvoice(
    creds,
    order.paymentHash ? { payment_hash: order.paymentHash } : { invoice: order.bolt11 }
  );
  
  // Check multiple possible settlement indicators:
  // - settled_at: timestamp (Alby NWC uses this)
  // - settled: boolean
  // - paid: boolean  
  // - state: 'SETTLED'
  const settled = !!(resp?.settled || resp?.paid || resp?.state === 'SETTLED' || resp?.settled_at);
  if (!settled) {
    // Still waiting for payment
    return order;
  }
  
  logger.info({
    msg: 'invoice.settled',
    orderId: order.id,
    invoiceRef: order.invoiceRef
  });

  // Reload order to check if it was already settled by another process
  await order.reload();
  if (order.status !== 'awaiting_payment') {
    logger.info({
      msg: 'invoice.already-settled',
      orderId: order.id,
      status: order.status
    });
    return order;
  }

  order.preimage = resp.preimage || null;
  order.paidAt = new Date();
  order.status = 'paid';
  order.nextPollAt = null;
  
  // Store the redirect URL for the success page (BTCPay-style)
  // Prefer the order_status_url from webhook, fallback to checkout token
  const hadRedirectUrl = !!order.redirectUrl;
  if (!order.redirectUrl) {
    if (order.checkoutToken) {
      order.redirectUrl = `https://${shop.domain}/checkout/orders/${order.checkoutToken}`;
      logger.info({
        msg: 'settlement.redirectUrl.generated',
        orderId: order.id,
        redirectUrl: order.redirectUrl,
        source: 'checkoutToken-fallback',
        checkoutToken: order.checkoutToken
      });
    } else {
      logger.warn({
        msg: 'settlement.redirectUrl.missing',
        orderId: order.id,
        note: 'No order_status_url from webhook and no checkoutToken'
      });
    }
  } else {
    logger.info({
      msg: 'settlement.redirectUrl.existing',
      orderId: order.id,
      redirectUrl: order.redirectUrl,
      source: 'webhook-or-previous'
    });
  }
  
  await order.save();

  if (order.orderGid && shop.shopifyAccessToken) {
    try {
      await orderMarkAsPaid(shop, order.orderGid);
    } catch (e: any) {
      // If the order is already marked as paid, that's okay - log but don't throw
      if (e.message?.includes('cannot be marked as paid')) {
        logger.info({
          msg: 'order.already-marked-paid',
          orderId: order.id,
          orderGid: order.orderGid
        });
      } else {
        throw e;
      }
    }
  }
  return order;
}