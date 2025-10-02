/**
 * Purpose: public JSON endpoints to create/check invoices.
 * Called by: hosted pay page JS; any storefront script.
 * CORS: allow all origins as required by Checkout UI extensions network access.
 */
import express from 'express';
import { Shop } from '../store/entities/Shop';
import { WalletConnection } from '../store/entities/WalletConnection';
import { Order } from '../store/entities/Order';
import { createInvoiceForCheckout, lookupInvoiceAndSettle } from '../util/invoices';

export const router = express.Router();

// CORS configuration
const ALLOW_METHODS = 'GET, POST, OPTIONS';

// Rate limiting - in-memory storage for invoice creation attempts
interface RateLimitEntry {
  timestamp: number;
  ip: string;
}

const invoiceAttempts: RateLimitEntry[] = [];
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
const RATE_LIMIT_MAX_ATTEMPTS = 30;

function cleanupOldAttempts() {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  const startLength = invoiceAttempts.length;
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < invoiceAttempts.length; readIndex++) {
    if (invoiceAttempts[readIndex].timestamp > cutoff) {
      if (writeIndex !== readIndex) {
        invoiceAttempts[writeIndex] = invoiceAttempts[readIndex];
      }
      writeIndex++;
    }
  }
  invoiceAttempts.length = writeIndex;
}

function checkRateLimit(ip: string): boolean {
  cleanupOldAttempts();
  const recentAttempts = invoiceAttempts.filter(entry => entry.ip === ip);
  return recentAttempts.length < RATE_LIMIT_MAX_ATTEMPTS;
}

function recordAttempt(ip: string) {
  invoiceAttempts.push({ timestamp: Date.now(), ip });
}

// Input validation helpers
function isValidCurrency(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency);
}

function isValidAmount(amount: number): boolean {
  return typeof amount === 'number' && amount > 0 && amount < 1000000 && Number.isFinite(amount);
}

function isValidMemo(memo: string): boolean {
  return typeof memo === 'string' && memo.length <= 100;
}

// If you want to keep "*", skip origin reflection but still add methods.
// If you'd like a soft allowlist, reflect the incoming Origin instead:
function allowOrigin(origin?: string | null) {
  if (!origin) return '*'; // or return nothing
  // Example soft allowlist (tweak to your needs):
  if (origin.endsWith('.myshopify.com') || origin.endsWith('.shopify.com')) return origin;
  if (process.env.THIS_APP_DOMAIN && origin.endsWith(process.env.THIS_APP_DOMAIN)) return origin;
  return '*'; // fallback
}

router.use((req, res, next) => {
  const origin = req.get('Origin');
  const allowed = allowOrigin(origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// POST /checkout/:publicId/create-invoice
router.post('/checkout/:publicId/create-invoice', async (req, res, next) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Rate limiting check
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'rate-limit-exceeded' });
    }
    
    recordAttempt(clientIp);

    const { publicId } = req.params;
    const { shopDomain, amount, currency, checkoutToken, orderGid, orderName, desc } = req.body as any;
    
    // Input validation
    if (!isValidAmount(Number(amount))) {
      return res.status(400).json({ error: 'invalid-amount' });
    }
    
    const currencyCode = (currency || process.env.CURRENCY || 'USD').toUpperCase();
    if (!isValidCurrency(currencyCode)) {
      return res.status(400).json({ error: 'invalid-currency' });
    }
    
    if (desc && !isValidMemo(String(desc))) {
      return res.status(400).json({ error: 'invalid-memo' });
    }

    const shop = await Shop.findOneByOrFail({ publicId });
    if (shop.domain !== shopDomain) return res.status(400).json({ error: 'shop-mismatch' });
    const wallet = await WalletConnection.findOne({ where: { shop: { id: shop.id } } as any });
    if (!wallet) return res.status(400).json({ error: 'no-wallet' });

    const out = await createInvoiceForCheckout({
      shop,
      wallet,
      amount: Number(amount),
      currency: currencyCode,
      checkoutToken: checkoutToken || null,
      orderGid: orderGid || null,
      orderName: orderName || null,
      desc: desc || null
    });
    res.json({ invoiceRef: out.invoiceRef, bolt11: out.bolt11, paymentHash: out.paymentHash, expiresAt: out.order.expiresAt.toISOString(), memo: out.order.bolt11Memo });
  } catch (e: any) {
    if (String(e?.message) === 'wallet-capabilities') return res.status(400).json({ error: 'wallet-missing-capabilities' });
    next(e);
  }
});

// GET /checkout/:publicId/check-invoice
router.get('/checkout/:publicId/check-invoice', async (req, res, next) => {
  try {
    const { publicId } = req.params;
    const { invoiceRef } = req.query as any;
    const shop = await Shop.findOneByOrFail({ publicId });
    const order = await Order.findOne({ where: { invoiceRef, shop: { id: shop.id } as any } });
    if (!order) return res.status(404).json({ status: 'unknown' });

    if (order.status === 'awaiting_payment') {
      if (order.expiresAt <= new Date()) return res.json({ status: 'failed' });
      const wallet = await WalletConnection.findOne({ where: { shop: { id: shop.id } } as any });
      if (wallet) await lookupInvoiceAndSettle(order, shop, wallet);
    }
    const refreshed = await Order.findOneByOrFail({ id: order.id });
    res.json({ 
      status: refreshed.status,
      redirectUrl: refreshed.redirectUrl || null
    });
  } catch (e) { next(e); }
});