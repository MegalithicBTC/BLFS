/**
 * Purpose: Shopify webhooks: link orders to invoiceRef; enrich local Order with concise summary.
 * Called by: Shopify -> POST /webhooks/... with raw body; HMAC verified.
 */
import express, { raw } from 'express';
import crypto from 'crypto';
import { Shop } from '../store/entities/Shop';
import { Order } from '../store/entities/Order';
import { decryptString } from '../util/crypto';
import { buildOrderSummaryFromWebhookPayload } from '../util/summary';
import { logger } from '../util/logger';

export const router = express.Router();

function verifyHmac(rawBody: Buffer, hmacHeader?: string, secret?: string | null) {
  if (!hmacHeader || !secret) return false;
  // Compute raw digest bytes; compare to decoded header bytes.
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest(); // Buffer
  const sent = Buffer.from(hmacHeader, 'base64'); // Buffer
  return sent.length === digest.length && crypto.timingSafeEqual(digest, sent);
}

router.post('/orders-create', raw({ type: '*/*' }), async (req, res) => {
  const startTime = Date.now();
  try {
    const shopDomain = String(req.get('X-Shopify-Shop-Domain') || '');
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    
    logger.info({ 
      msg: 'webhook received', 
      webhook: 'orders-create', 
      shopDomain,
      hasHmac: !!hmacHeader,
      bodySize: (req.body as Buffer).length
    });

    const shop = await Shop.findOneBy({ domain: shopDomain });
    if (!shop) {
      logger.warn({ msg: 'webhook shop not found', shopDomain });
      return res.status(404).end();
    }

    const secret = decryptString(shop.shopifyWebhookSecret) || decryptString(shop.shopifyApiSecret);
    const ok = verifyHmac(req.body as Buffer, hmacHeader as string, secret);
    if (!ok) {
      logger.error({ msg: 'webhook HMAC verification failed', shopDomain, shopId: shop.id });
      return res.status(401).end();
    }

    const payload = JSON.parse((req.body as Buffer).toString('utf8'));
    const orderId = payload.id;
    const orderGid = `gid://shopify/Order/${orderId}`;
    const orderName = payload.name || payload.order_number;


    console.log('=== WEBHOOK FULL PAYLOAD ===');
    console.log(JSON.stringify(payload, null, 2));
    console.log('=== END WEBHOOK PAYLOAD ===');

    logger.info({ 
      msg: 'webhook HMAC verified', 
      shopId: shop.id, 
      orderGid, 
      orderName,
      totalPrice: payload.total_price,
      currency: payload.currency
    });

    // Try to find our local order by GID first; fall back to invoiceRef note attribute.
    let local = await Order.findOne({ where: { orderGid, shop: { id: shop.id } as any } });
    if (!local) {
      const attrs = (payload.note_attributes || payload.attributes || []);
      const map: Record<string, string> = {};
      for (const a of attrs) map[a.name || a.key] = a.value;
      const invoiceRef = map['invoiceRef'];
      
      logger.info({ 
        msg: 'order not found by GID, checking attributes', 
        orderGid,
        hasAttributes: attrs.length > 0,
        invoiceRefFound: !!invoiceRef,
        allAttributes: Object.keys(map)
      });
      
      if (invoiceRef) {
        local = await Order.findOne({ where: { invoiceRef, shop: { id: shop.id } as any } });
        if (local && !local.orderGid) { local.orderGid = orderGid; }
      }
    }

    if (local) {
      logger.info({ 
        msg: 'webhook order matched', 
        orderId: local.id, 
        invoiceRef: local.invoiceRef,
        previousStatus: local.status
      });
      
      local.shopifyOrderName = payload.name || null;
      local.shopifyOrderNumber = Number(payload.order_number || 0) || null;
      local.customerNote = payload.note || null;
      local.shopifyTags = typeof payload.tags === 'string' ? payload.tags : null;
      local.orderSummary = buildOrderSummaryFromWebhookPayload(payload);
      // Store order status URL from Shopify webhook
      if (payload.order_status_url && !local.redirectUrl) {
        local.redirectUrl = payload.order_status_url;
        logger.info({
          msg: 'webhook.redirectUrl.set',
          orderId: local.id,
          redirectUrl: local.redirectUrl,
          source: 'webhook-order_status_url'
        });
      } else {
        logger.info({
          msg: 'webhook.redirectUrl.not-set',
          orderId: local.id,
          hasOrderStatusUrl: !!payload.order_status_url,
          alreadyHasRedirectUrl: !!local.redirectUrl,
          orderStatusUrl: payload.order_status_url || null
        });
      }
      await local.save();
      
      logger.info({ 
        msg: 'webhook order updated', 
        orderId: local.id,
        ms: Date.now() - startTime
      });
    } else {
      // Create placeholder order - invoice will be created later when user clicks "Complete payment"
      const amount = parseFloat(payload.total_price) || 0;
      const currency = (payload.currency || 'USD').toUpperCase();
      const orderSummary = buildOrderSummaryFromWebhookPayload(payload);
      const checkoutToken = payload.checkout_token || null;
      const orderStatusUrl = payload.order_status_url || null;
      
      logger.info({
        msg: 'webhook.new-order.redirect-info',
        orderGid,
        hasOrderStatusUrl: !!orderStatusUrl,
        hasCheckoutToken: !!checkoutToken,
        orderStatusUrl,
        checkoutToken
      });
      
      const order = Order.create({
        shop,
        orderGid,
        checkoutToken, // Store checkout token from webhook
        invoiceRef: `temp-${orderGid}`, // Temporary unique value, will be replaced when invoice is created
        presentmentCurrency: currency,
        amountPresentment: amount,
        msat: '0', // Will be set when invoice is created
        status: 'awaiting_payment',
        bolt11: '', // Will be set when invoice is created
        paymentHash: null,
        preimage: null,
        shopifyOrderName: payload.name || null,
        shopifyOrderNumber: Number(payload.order_number || 0) || null,
        customerNote: payload.note || null,
        shopifyTags: typeof payload.tags === 'string' ? payload.tags : null,
        orderSummary,
        bolt11Memo: null,
        redirectUrl: orderStatusUrl,
        paidAt: null,
        exchangeRateUsed: null,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min from now
        nextPollAt: null, // Don't poll until invoice is created
        pollAttempts: 0
      });
      await order.save();
      
      // Log the newly created order instance
      console.log('=== NEW ORDER CREATED ===');
      console.log(JSON.stringify({
        id: order.id,
        orderGid: order.orderGid,
        checkoutToken: order.checkoutToken,
        orderName: order.shopifyOrderName,
        amount: order.amountPresentment,
        currency: order.presentmentCurrency,
        orderSummary: order.orderSummary,
        status: order.status,
        bolt11: order.bolt11 || '(empty - will be set when invoice created)',
        invoiceRef: order.invoiceRef,
        nextPollAt: order.nextPollAt,
        expiresAt: order.expiresAt
      }, null, 2));
      console.log('=== END NEW ORDER ===');
      
      logger.info({ 
        msg: 'webhook order created (placeholder)', 
        orderId: order.id,
        orderGid,
        orderName,
        amount,
        currency,
        note: 'Invoice will be created when user clicks Complete payment button'
      });
    }

    res.status(200).end();
  } catch (e) { 
    logger.error({ msg: 'orders-create webhook failed', error: e, ms: Date.now() - startTime });
    res.status(500).end(); 
  }
});

router.post('/app-uninstalled', raw({ type: '*/*' }), async (req, res) => {
  try {
    const shopDomain = String(req.get('X-Shopify-Shop-Domain') || '');
    
    logger.info({ 
      msg: 'webhook received', 
      webhook: 'app-uninstalled', 
      shopDomain 
    });

    const shop = await Shop.findOneBy({ domain: shopDomain });
    if (!shop) {
      logger.warn({ msg: 'webhook shop not found', shopDomain });
      return res.status(404).end();
    }

    const secret = decryptString(shop.shopifyWebhookSecret) || decryptString(shop.shopifyApiSecret);
    const ok = verifyHmac(req.body as Buffer, req.get('X-Shopify-Hmac-Sha256') as string, secret);
    if (!ok) {
      logger.error({ msg: 'webhook HMAC verification failed', webhook: 'app-uninstalled', shopDomain });
      return res.status(401).end();
    }

    logger.info({ msg: 'app uninstalled, clearing access token', shopId: shop.id, shopDomain });
    
    shop.shopifyAccessToken = null;
    await shop.save();
    res.status(200).end();
  } catch (e) { 
    logger.error({ msg: 'app-uninstalled webhook failed', error: e });
    res.status(500).end(); 
  }
});