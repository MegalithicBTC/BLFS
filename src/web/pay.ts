/**
 * Purpose: hosted invoice page; if no invoiceRef query param, auto-create invoice.
 * Called by: Checkout UI extension button opening /pay/:publicId?amount=...&currency=...&orderGid=...&orderName=...&desc=...&shopDomain=...
 */
import express from 'express';
import { Shop } from '../store/entities/Shop';
import { WalletConnection } from '../store/entities/WalletConnection';
import { createInvoiceForCheckout } from '../util/invoices';
import { Order } from '../store/entities/Order';

export const router = express.Router();

router.get('/pay/:publicId', async (req, res, next) => {
  try {
    // Log all incoming data
    console.log('=== /pay REQUEST ===');
    console.log('URL:', req.url);
    console.log('publicId:', req.params.publicId);
    console.log('Query params:', JSON.stringify(req.query, null, 2));
    console.log('=== END /pay REQUEST ===');
    
    const shop = await Shop.findOneByOrFail({ publicId: req.params.publicId });
    const wallet = await WalletConnection.findOne({ where: { shop: { id: shop.id } } as any });
    if (!wallet) return res.status(400).send('No wallet');

    let order: Order | null = null;
    let bolt11 = '';
    let invoiceRef = String(req.query.invoiceRef || '');
    
    if (invoiceRef) {
      // Existing invoice - just display it
      order = await Order.findOneBy({ invoiceRef });
      if (!order) return res.status(404).send('Unknown invoice');
      bolt11 = order.bolt11;
    } else {
      const amountStr = String(req.query.amount || '0');
      const amount = parseFloat(amountStr) || 0;
      const currency = String(req.query.currency || process.env.CURRENCY || 'USD');
      const checkoutToken = String(req.query.checkoutToken || '');
      let orderGid = String(req.query.orderGid || '');
      const orderName = String(req.query.orderName || '');
      const desc = String(req.query.desc || '');
      
      // Normalize OrderIdentity to Order format
      // Shopify sends OrderIdentity in checkout but Order in webhooks
      if (orderGid.includes('/OrderIdentity/')) {
        const orderId = orderGid.split('/').pop();
        orderGid = `gid://shopify/Order/${orderId}`;
        console.log(`Normalized OrderIdentity to Order GID: ${orderGid}`);
      }
      
      if (amount <= 0) {
        return res.status(400).send('Invalid amount: must be greater than 0');
      }
      
      // Check if order already exists (created by webhook)
      // Priority order: orderGid > checkoutToken
      // Webhook creates order with orderGid first, checkoutToken may be null initially
      if (orderGid) {
        order = await Order.findOne({ where: { orderGid, shop: { id: shop.id } } as any });
        console.log(`Looked up order by orderGid ${orderGid}: ${order ? 'found' : 'not found'}`);
      }
      if (!order && checkoutToken) {
        order = await Order.findOne({ where: { checkoutToken, shop: { id: shop.id } } as any });
        console.log(`Looked up order by checkoutToken ${checkoutToken}: ${order ? 'found' : 'not found'}`);
      }
      
      if (order && order.bolt11) {
        // Order exists and already has an invoice
        console.log(`Using existing invoice for order ${order.id}`);
        bolt11 = order.bolt11;
        invoiceRef = order.invoiceRef;
      } else if (order) {
        // Order exists but no invoice yet - create invoice and update the order
        console.log(`Creating invoice for existing order ${order.id}: amount=${amount}, currency=${currency}`);
        const out = await createInvoiceForCheckout({ 
          shop, wallet, amount, currency, checkoutToken, orderGid, orderName, desc,
          existingOrder: order 
        });
        order = out.order; 
        bolt11 = out.bolt11; 
        invoiceRef = out.invoiceRef;
      } else {
        // No order exists - create new order with invoice
        console.log(`Creating new invoice: amount=${amount}, currency=${currency}, orderName=${orderName}`);
        const out = await createInvoiceForCheckout({ 
          shop, wallet, amount, currency, checkoutToken, orderGid, orderName, desc 
        });
        order = out.order; 
        bolt11 = out.bolt11; 
        invoiceRef = out.invoiceRef;
      }
    }

    res.render('pay_invoice', {
      publicId: shop.publicId,
      invoiceRef,
      bolt11,
      expiresAtISO: order!.expiresAt.toISOString(),
      shop: {
        domain: shop.domain,
        merchantLogoUrl: shop.merchantLogoUrl
      },
      order: {
        orderSummary: order!.orderSummary,
        amountPresentment: order!.amountPresentment,
        presentmentCurrency: order!.presentmentCurrency,
        msat: order!.msat,
        shopifyOrderName: order!.shopifyOrderName
      }
    });
  } catch (e) { next(e); }
});