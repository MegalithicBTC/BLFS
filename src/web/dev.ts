/**
 * Purpose: developer console for setrouter.get('/dev', async (req, res) => {
  const shops = await Shop.find();
  res.render('dev_home', { shops, created: null, query: req.query });
});aintenance.
 * Called by: developer via browser under Basic auth on /dev...
 * Flow: create shop → save OAuth creds → run OAuth → ensure webhooks → save Partner CLI token → deploy extension → register/verify NWC.
 * Visible errors: verification shows explicit "missing: ..." when wallet lacks required capabilities.
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { EntityManager } from 'typeorm';
import { basicOk } from '../util/auth';
import { Shop } from '../store/entities/Shop';
import { Order } from '../store/entities/Order';
import { WalletConnection } from '../store/entities/WalletConnection';
import { AppDataSource } from '../store/data-source';
import { randomId, randomPassword, encryptString, decryptString } from '../util/crypto';
import { registerNwc } from '../util/nwcOnboarding';
import { exchangeCodeForToken } from '../util/shopify';
import { ensureWebhooks } from '../util/shopify_webhooks';
import { deployThankYouExtension } from '../util/deploy';
import { startListenerForWallet } from '../util/notifications';
import { logger } from '../util/logger';

export const router = express.Router();

function verifyShopifyQueryHmac(query: any, apiSecret: string) {
  const { hmac, signature, ...rest } = query as Record<string, string>;
  // Build the message: sorted key=value pairs, '&' joined, excluding hmac/signature
  const pairs = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`);
  const msg = pairs.join('&');
  const calc = crypto.createHmac('sha256', apiSecret).update(msg).digest('hex');
  // Shopify provides `hmac` hex-encoded
  if (!hmac || typeof hmac !== 'string') return false;
  const a = Buffer.from(calc, 'utf8');
  const b = Buffer.from(hmac, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.use('/dev', (req, res, next) => {
  if (!basicOk(req.headers.authorization)) return res.status(401).set('WWW-Authenticate','Basic realm="Developer Portal"').end();
  next();
});

router.get('/dev', async (_req, res) => {
  const shops = await Shop.find();
  res.render('dev_home', { shops, created: null });
});

router.post('/dev/shops', async (req, res) => {
  const { domain, label, merchantUser, merchantLogoUrl, shopifyApiKey, shopifyApiSecret, shopifyCliToken, nwcUri } = req.body as any;
  const pw = randomPassword();
  const shop = Shop.create({
    publicId: randomId(),
    domain,
    label: label || '',
    merchantUser,
    merchantLogoUrl: merchantLogoUrl && merchantLogoUrl.trim() ? merchantLogoUrl.trim() : null,
    merchantPasswordHash: bcrypt.hashSync(pw, 12),
    merchantUrlToken: randomId(),
    shopifyApiKey: encryptString(shopifyApiKey || '')!,
    shopifyApiSecret: encryptString(shopifyApiSecret || '')!,
    shopifyWebhookSecret: null,
    shopifyScopes: 'read_orders,write_orders',  // Fixed scopes for all merchants
    shopifyAccessToken: null,
    shopifyInstalledAt: null,
    partnerCliToken: shopifyCliToken ? encryptString(shopifyCliToken)! : null
  });
  await shop.save();
  
  // If NWC URI is provided, register it immediately
  let wcError = null;
  if (nwcUri && nwcUri.trim()) {
    try {
      const wc = await registerNwc(shop.id, nwcUri.trim());
      if (wc) await startListenerForWallet(wc);
    } catch (e: any) {
      wcError = e.message || 'Failed to register NWC';
      logger.warn({ msg: 'Failed to register NWC during shop creation', shopId: shop.id, error: e });
    }
  }
  
  const origin = `https://${process.env.THIS_APP_DOMAIN}`;
  const portal = `${origin}/m/${shop.publicId}/${shop.merchantUrlToken}/overview`;
  const shops = await Shop.find();
  res.render('dev_home', {
    shops,
    created: {
      portal,              // clean link with no creds
      user: shop.merchantUser,
      password: pw,
      nwcError: wcError
    },
    query: {}
  });
});

router.get('/dev/shops/:publicId', async (req, res) => {
  const shop = await Shop.findOneByOrFail({ publicId: req.params.publicId });
  const wc = await WalletConnection.findOne({ where: { shop: { id: shop.id } as any } });
  const origin = `https://${process.env.THIS_APP_DOMAIN}`;
  const portal = `${origin}/m/${shop.publicId}/${shop.merchantUrlToken}/overview`;
  
  // Decrypt sensitive fields for display
  const decryptedApiKey = shop.shopifyApiKey ? decryptString(shop.shopifyApiKey) : null;
  const decryptedApiSecret = shop.shopifyApiSecret ? decryptString(shop.shopifyApiSecret) : null;
  const decryptedPartnerToken = shop.partnerCliToken ? decryptString(shop.partnerCliToken) : null;
  const decryptedNwcUri = wc?.nwcUri ? decryptString(wc.nwcUri) : null;
  
  // Build flash message from query params
  let flash = null;
  if (req.query.success === '1') {
    if (req.query.nwc === '1') {
      flash = { kind: 'ok', text: 'Merchant updated successfully! NWC registered and verified.' };
    } else if (req.query.nwcError) {
      flash = { kind: 'error', text: `Merchant updated, but NWC error: ${req.query.nwcError}` };
    } else {
      flash = { kind: 'ok', text: 'Merchant updated successfully!' };
    }
  } else if (req.query.error === 'nwc-not-readonly') {
    flash = { kind: 'error', text: 'SECURITY ERROR: Cannot proceed - your NWC wallet has write capabilities. Please provide a read-only wallet connection.' };
  }
  
  res.render('dev_shop', { shop, wc, portal, flash, decryptedApiKey, decryptedApiSecret, decryptedPartnerToken, decryptedNwcUri });
});

router.get('/dev/shops/:publicId/merchant-view', async (req, res) => {
  const shop = await Shop.findOneByOrFail({ publicId: req.params.publicId });
  const orders = await Order.find({ where: { shop: { id: shop.id } as any }, order: { createdAt: 'DESC' }, take: 200 });
  res.render('merchant_overview', { shop, orders });
});

router.post('/dev/shops/:publicId/merchant/rotate-link', async (req, res) => {
  const shop = await Shop.findOneByOrFail({ publicId: req.params.publicId });
  shop.merchantUrlToken = randomId();
  await shop.save();
  res.redirect(`/dev/shops/${shop.publicId}`);
});

router.post('/dev/shops/:publicId/merchant/reset-password', async (req, res) => {
  const shop = await Shop.findOneByOrFail({ publicId: req.params.publicId });
  const { merchantUser } = req.body as any;
  const pw = randomPassword();
  shop.merchantUser = merchantUser;
  shop.merchantPasswordHash = bcrypt.hashSync(pw, 12);
  await shop.save();
  const origin = `https://${process.env.THIS_APP_DOMAIN}`;
  const portal = `${origin}/m/${shop.publicId}/${shop.merchantUrlToken}/overview`;
  res.render('dev_password_shown_once', { shop, portal, user: shop.merchantUser, password: pw });
});

router.post('/dev/shops/:publicId/shopify/credentials', async (req, res) => {
  const shop = await Shop.findOneByOrFail({ publicId: req.params.publicId });
  const { label, merchantUser, shopDomain, merchantLogoUrl, apiKey, apiSecret, partnerCliToken, webhookSecret, nwcUri } = req.body as any;
  
  let flash = null;
  
  // Update label if provided
  if (label !== undefined && label.trim()) {
    shop.label = label.trim();
  }
  
  // Update merchant user if provided
  if (merchantUser && merchantUser.trim()) {
    shop.merchantUser = merchantUser.trim();
  }
  
  // Update shop domain if provided
  if (shopDomain && shopDomain.trim()) {
    shop.domain = shopDomain.trim();
  }
  
  // Update merchant logo URL
  if (merchantLogoUrl !== undefined) {
    shop.merchantLogoUrl = merchantLogoUrl && merchantLogoUrl.trim() ? merchantLogoUrl.trim() : null;
  }
  
  // Update Shopify credentials if provided
  if (apiKey && apiKey.trim() && !apiKey.includes('[SAVED')) {
    shop.shopifyApiKey = encryptString(apiKey.trim())!;
  }
  if (apiSecret && apiSecret.trim() && !apiSecret.includes('[SAVED')) {
    shop.shopifyApiSecret = encryptString(apiSecret.trim())!;
  }
  
  // Update Partner CLI token if provided
  if (partnerCliToken && partnerCliToken.trim() && !partnerCliToken.includes('[SAVED')) {
    shop.partnerCliToken = encryptString(partnerCliToken.trim())!;
  }
  
  // Handle webhook secret (optional)
  if (webhookSecret && webhookSecret.trim()) {
    shop.shopifyWebhookSecret = encryptString(webhookSecret.trim())!;
  }
  
  // Set fixed scopes for all merchants
  shop.shopifyScopes = 'read_orders,write_orders';
  await shop.save();
  
  // Handle NWC URI update if provided
  if (nwcUri && nwcUri.trim()) {
    try {
      const wc = await registerNwc(shop.id, nwcUri.trim());
      if (wc) await startListenerForWallet(wc);
      return res.redirect(`/dev/shops/${shop.publicId}?success=1&nwc=1`);
    } catch (e: any) {
      logger.warn({ msg: 'Failed to register NWC during credentials update', shopId: shop.id, error: e });
      return res.redirect(`/dev/shops/${shop.publicId}?success=1&nwcError=${encodeURIComponent(e.message || 'Failed to register NWC')}`);
    }
  } else {
    return res.redirect(`/dev/shops/${shop.publicId}?success=1`);
  }
});

router.get('/dev/shops/:publicId/admin-oauth/start', async (req, res) => {
  const shop = await Shop.findOneByOrFail({ publicId: req.params.publicId });
  
  // Check if wallet connection exists and passed read-only validation
  const wc = await WalletConnection.findOne({ where: { shop: { id: shop.id } as any } });
  if (wc && wc.failedReadOnlyValidation) {
    return res.redirect(`/dev/shops/${shop.publicId}?error=nwc-not-readonly`);
  }
  
  const { shop: shopDomain } = req.query as any;
  const apiKey = decryptString(shop.shopifyApiKey)!;
  const fixedScopes = 'read_orders,write_orders';
  const redirectUri = `https://${process.env.THIS_APP_DOMAIN}/dev/admin-oauth/callback`;
  console.log("Starting OAuth for shop", shopDomain, "with redirect URI", redirectUri);
  const url = `https://${shopDomain}/admin/oauth/authorize?client_id=${encodeURIComponent(apiKey)}&scope=${encodeURIComponent(fixedScopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${shop.publicId}`;
  console.log("Redirecting to Shopify OAuth URL:", url);
  res.redirect(url);
});

// Static OAuth callback (uses state to find the shop)
router.get('/dev/admin-oauth/callback', async (req, res) => {
  const publicId = String(req.query.state || '');
  const shop = await Shop.findOneByOrFail({ publicId });
  const apiSecret = decryptString(shop.shopifyApiSecret)!;
  if (!verifyShopifyQueryHmac(req.query, apiSecret)) {
    return res.status(401).type('text/plain').send('invalid-hmac');
  }

  const token = await exchangeCodeForToken(
    String(req.query.shop),
    String(req.query.code),
    decryptString(shop.shopifyApiKey)!,
    apiSecret
  );
  shop.shopifyAccessToken = encryptString(token)!;
  shop.shopifyInstalledAt = new Date();
  await shop.save();

  try { 
    await ensureWebhooks(shop); 
  } catch (e) { 
    logger.error({ msg: 'ensureWebhooks failed during OAuth callback', shopId: shop.id, error: e }); 
  }

  res.redirect(`/dev/shops/${shop.publicId}`);
});

router.post('/dev/shops/:publicId/partner-cli/deploy', async (req, res) => {
  const shop = await Shop.findOneByOrFail({ publicId: req.params.publicId });
  
  // Check if wallet connection exists and passed read-only validation
  const wc = await WalletConnection.findOne({ where: { shop: { id: shop.id } as any } });
  if (wc && wc.failedReadOnlyValidation) {
    return res.status(403).type('text/plain').send('ERROR: Cannot deploy - NWC wallet has write capabilities. Please provide a read-only NWC wallet connection.');
  }
  
  try {
    const result = await deployThankYouExtension(shop);
    // Return logs regardless of success/failure
    if (result.ok) {
      // Update last deployed timestamp on success
      shop.lastDeployedAt = new Date();
      await shop.save();
      res.type('text/plain').send(result.log || 'Deployment successful');
    } else {
      res.status(500).type('text/plain').send(result.log || 'Deployment failed');
    }
  } catch (e: any) {
    res.status(500).type('text/plain').send(String(e?.message || e));
  }
});

router.post('/dev/shops/:publicId/nwc/register', async (req, res) => {
  try {
    const shop = await Shop.findOneByOrFail({ publicId: req.params.publicId });
    const wc = await registerNwc(shop.id, String((req.body as any).nwcUri || ''));
    if (wc) await startListenerForWallet(wc);
    
    // Decrypt sensitive fields for display
    const decryptedApiKey = shop.shopifyApiKey ? decryptString(shop.shopifyApiKey) : null;
    const decryptedApiSecret = shop.shopifyApiSecret ? decryptString(shop.shopifyApiSecret) : null;
    const decryptedPartnerToken = shop.partnerCliToken ? decryptString(shop.partnerCliToken) : null;
    const decryptedNwcUri = wc?.nwcUri ? decryptString(wc.nwcUri) : null;
    
    return res.render('dev_shop', { shop, wc, flash: { kind: 'ok', text: 'NWC registered successfully! All required capabilities verified and notifications active.' }, decryptedApiKey, decryptedApiSecret, decryptedPartnerToken, decryptedNwcUri });
  } catch (e: any) {
    const shop = await Shop.findOneByOrFail({ publicId: req.params.publicId });
    const wc = await WalletConnection.findOne({ where: { shop: { id: shop.id } as any } });
    
    // Decrypt sensitive fields for display
    const decryptedApiKey = shop.shopifyApiKey ? decryptString(shop.shopifyApiKey) : null;
    const decryptedApiSecret = shop.shopifyApiSecret ? decryptString(shop.shopifyApiSecret) : null;
    const decryptedPartnerToken = shop.partnerCliToken ? decryptString(shop.partnerCliToken) : null;
    const decryptedNwcUri = wc?.nwcUri ? decryptString(wc.nwcUri) : null;
    
    return res.render('dev_shop', { shop, wc, flash: { kind: 'error', text: e.message || 'Failed to register NWC' }, decryptedApiKey, decryptedApiSecret, decryptedPartnerToken, decryptedNwcUri });
  }
});

router.get('/dev/shops/:publicId/delete', async (req, res) => {
  try {
    const shop = await Shop.findOne({ 
      where: { publicId: req.params.publicId },
      relations: ['orders', 'wallets']
    });
    
    if (!shop) {
      return res.status(404).type('text/plain').send('Shop not found');
    }
    
    const orderCount = shop.orders?.length || 0;
    const walletCount = shop.wallets?.length || 0;
    
    // Use a transaction to ensure all deletions happen atomically
    await AppDataSource.transaction(async (manager: EntityManager) => {
      // Delete related records first to avoid foreign key constraints
      if (shop.orders?.length > 0) {
        await manager.remove(Order, shop.orders);
      }
      if (shop.wallets?.length > 0) {
        await manager.remove(WalletConnection, shop.wallets);
      }
      
      // Now remove the shop
      await manager.remove(Shop, shop);
    });
    
    logger.info({ 
      msg: 'Merchant deleted successfully', 
      shopId: shop.id, 
      domain: shop.domain, 
      deletedOrders: orderCount,
      deletedWallets: walletCount
    });
    
    res.redirect('/dev?deleted=1');
  } catch (e: any) {
    logger.error({ msg: 'Failed to delete merchant', publicId: req.params.publicId, error: e });
    res.status(500).type('text/plain').send(`Failed to delete merchant: ${e.message || e}`);
  }
});

router.get('/dev/export-orders', async (req, res) => {
  try {
    const devFeePercent = parseFloat(String(req.query.devFeePercent || '1'));
    if (isNaN(devFeePercent) || devFeePercent < 0 || devFeePercent > 100) {
      return res.status(400).type('text/plain').send('Invalid developer fee percentage');
    }
    
    // Fetch all orders with their shops, ordered by shop name DESC then date DESC
    const orders = await Order.find({
      relations: ['shop'],
      order: {
        shop: { domain: 'DESC' },
        createdAt: 'DESC'
      }
    });
    
    // Build CSV header
    const headers = [
      'Shop Name',
      'Shop Label',
      'Order ID',
      'Order Number',
      'Order Name',
      'Status',
      'Presentment Currency',
      'Amount Presentment',
      'Amount Sats',
      'Gross Sales Sats',
      `Developer Fee Sats (${devFeePercent}%)`,
      'Order Summary',
      'Customer Note',
      'Shopify Tags',
      'Payment Hash',
      'Preimage',
      'Paid At',
      'Exchange Rate Used',
      'Created At',
      'Expires At'
    ];
    
    // Build CSV rows
    const rows = orders.map(order => {
      const msatValue = parseFloat(order.msat);
      const satsValue = Math.floor(msatValue / 1000);
      const grossSalesSats = satsValue;
      const devFeeSats = Math.floor((grossSalesSats * devFeePercent) / 100);
      
      return [
        order.shop.domain,
        order.shop.label || '',
        order.id,
        order.shopifyOrderNumber ?? '',
        order.shopifyOrderName ?? '',
        order.status,
        order.presentmentCurrency,
        order.amountPresentment,
        satsValue,
        grossSalesSats,
        devFeeSats,
        (order.orderSummary ?? '').replace(/"/g, '""'),  // Escape quotes in CSV
        (order.customerNote ?? '').replace(/"/g, '""'),
        (order.shopifyTags ?? '').replace(/"/g, '""'),
        order.paymentHash ?? '',
        order.preimage ?? '',
        order.paidAt ? order.paidAt.toISOString() : '',
        order.exchangeRateUsed ?? '',
        order.createdAt.toISOString(),
        order.expiresAt.toISOString()
      ];
    });
    
    // Convert to CSV format
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Send CSV file
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="blfs-orders-export-${timestamp}.csv"`);
    res.send(csvContent);
    
    logger.info({ 
      msg: 'Orders exported to CSV', 
      orderCount: orders.length, 
      devFeePercent 
    });
  } catch (e: any) {
    logger.error({ msg: 'Failed to export orders', error: e });
    res.status(500).type('text/plain').send(`Failed to export orders: ${e.message || e}`);
  }
});