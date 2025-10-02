/**
 * Purpose: ensure essential webhooks after OAuth: ORDERS_CREATE, APP_UNINSTALLED.
 * Called by: dev OAuth callback post‑token save.
 */
import { Shop } from '../store/entities/Shop';
import { decryptString } from './crypto';

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-07';

async function gql(shop: Shop, query: string, variables: any) {
  const token = decryptString(shop.shopifyAccessToken!)!;
  const res = await fetch(`https://${shop.domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } as any,
    body: JSON.stringify({ query, variables })
  } as any);
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error('shopify gql error');
  return json;
}

export async function ensureWebhooks(shop: Shop) {
  const base = `https://${process.env.THIS_APP_DOMAIN}`;
  const want = [
    {
      topic: 'ORDERS_CREATE',
      url: `${base}/webhooks/orders-create`,
      includeFields: [
        'id','name','order_number','currency','total_price','current_total_price','note','tags',
        'line_items.title','line_items.variant_title','line_items.quantity',
        'order_status_url','token'
      ]
    },
    { topic: 'APP_UNINSTALLED', url: `${base}/webhooks/app-uninstalled`, includeFields: ['id'] }
  ];
  for (const t of want) {
    const q = `
      mutation WebhookCreate($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!, $includeFields: [String!]) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: { callbackUrl: $callbackUrl, format: JSON, includeFields: $includeFields }) {
          userErrors { field message }
          webhookSubscription { id topic }
        }
      }`;
    await gql(shop, q, { topic: t.topic, callbackUrl: t.url, includeFields: t.includeFields });
  }
}