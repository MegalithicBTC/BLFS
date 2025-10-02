/**
 * Purpose: simple read-only merchant portal to list orders with summary and memo.
 * Called by: merchant via Basic auth at /m/:publicId/:token/overview.
 */
import express from 'express';
import { Shop } from '../store/entities/Shop';
import { Order } from '../store/entities/Order';
import { merchantOk } from '../util/auth';
import { logger } from '../util/logger';

export const router = express.Router();

// Test route to verify router is working
router.get('/m/test', (req, res) => {
  console.log('=== TEST ROUTE HIT ===');
  res.json({ message: 'Merchant router is working!' });
});

router.get('/m/:publicId/:token/overview', async (req, res) => {
  const { publicId, token } = req.params as any;
  
  console.log('=== MERCHANT ROUTE HIT ===');
  console.log('publicId:', publicId);
  console.log('token:', token);
  console.log('auth header:', req.headers.authorization ? 'PRESENT' : 'MISSING');
  
  logger.info('Merchant portal access attempt', {
    publicId,
    token,
    userAgent: req.headers['user-agent'],
    authHeaderPresent: !!req.headers.authorization,
    authHeader: req.headers.authorization ? 'Basic ***' : 'none'
  });
  
  const shop = await Shop.findOneBy({ publicId });
  if (!shop) {
    logger.warn('Shop not found', { publicId });
    return res.status(404).end();
  }
  
  if (shop.merchantUrlToken !== token) {
    logger.warn('Invalid merchant token', {
      publicId,
      providedToken: token,
      expectedToken: shop.merchantUrlToken
    });
    return res.status(404).end();
  }
  
  logger.info('Shop found, checking auth', {
    shopId: shop.id,
    domain: shop.domain,
    merchantUser: shop.merchantUser,
    authPresent: !!req.headers.authorization
  });
  
  if (!merchantOk(req.headers.authorization, shop.merchantUser, shop.merchantPasswordHash)) {
    logger.warn('Merchant auth failed', {
      shopId: shop.id,
      expectedUser: shop.merchantUser,
      authHeaderPresent: !!req.headers.authorization
    });
    return res.status(401).set('WWW-Authenticate',`Basic realm="Merchant Portal - ${shop.domain}"`).end();
  }
  
  logger.info('Merchant auth successful', { shopId: shop.id, merchantUser: shop.merchantUser });

  const orders = await Order.find({ where: { shop: { id: shop.id } as any }, order: { createdAt: 'DESC' }, take: 200 });
  res.render('merchant_overview', { shop, orders });
});