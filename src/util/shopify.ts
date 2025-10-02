/**
 * Purpose: Admin helpers: exchange OAuth code; mark order paid; cancel order.
 * Called by: dev OAuth callback; settlement/expiry flows.
 */
import { Shop } from '../store/entities/Shop';
import { decryptString } from './crypto';

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-07';

function headers(token: string) {
  return { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' };
}

export async function exchangeCodeForToken(shopDomain: string, code: string, apiKey: string, apiSecret: string): Promise<string> {
  const url = `https://${shopDomain}/admin/oauth/access_token`;
  const body = { client_id: apiKey, client_secret: apiSecret, code };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } as any, body: JSON.stringify(body) } as any);
  const json: any = await res.json();
  if (!json.access_token) throw new Error('no access_token');
  return json.access_token as string;
}

export async function orderMarkAsPaid(shop: Shop, orderGid: string): Promise<void> {
  const token = decryptString(shop.shopifyAccessToken!)!;
  const q = `
    mutation M($input: OrderMarkAsPaidInput!) {
      orderMarkAsPaid(input: $input) { order { id } userErrors { field message } }
    }`;
  
  console.log('=== orderMarkAsPaid REQUEST ===');
  console.log('shopDomain:', shop.domain);
  console.log('orderGid:', orderGid);
  console.log('hasAccessToken:', !!shop.shopifyAccessToken);
  
  const res = await fetch(`https://${shop.domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST', headers: headers(token) as any, body: JSON.stringify({ query: q, variables: { input: { id: orderGid } } })
  } as any);
  
  const json = await res.json();
  console.log('=== orderMarkAsPaid RESPONSE ===');
  console.log(JSON.stringify(json, null, 2));
  console.log('=== END orderMarkAsPaid ===');
  
  const errs = (json as any)?.data?.orderMarkAsPaid?.userErrors;
  if (errs && errs.length) {
    console.error('orderMarkAsPaid errors:', JSON.stringify(errs, null, 2));
    throw new Error(`orderMarkAsPaid failed: ${JSON.stringify(errs)}`);
  }
  
  // Check for top-level GraphQL errors
  if ((json as any)?.errors) {
    console.error('GraphQL errors:', JSON.stringify((json as any).errors, null, 2));
    throw new Error(`GraphQL error: ${JSON.stringify((json as any).errors)}`);
  }
}

export async function orderCancel(shop: Shop, orderGid: string): Promise<void> {
  const token = decryptString(shop.shopifyAccessToken!)!;
  const q = `
    mutation Cancel($orderId: ID!, $restock: Boolean!, $reason: OrderCancelReason!, $notify: Boolean) {
      orderCancel(orderId: $orderId, restock: $restock, reason: $reason, notifyCustomer: $notify) {
        job { id }
        orderCancelUserErrors { field message }
        userErrors { field message }
      }
    }`;
  const variables = { orderId: orderGid, restock: true, reason: 'CUSTOMER', notify: false };
  const res = await fetch(`https://${shop.domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST', headers: headers(token) as any, body: JSON.stringify({ query: q, variables })
  } as any);
  const json = await res.json();
  const errs = (json as any)?.data?.orderCancel?.orderCancelUserErrors || (json as any)?.data?.orderCancel?.userErrors;
  if (errs && errs.length) throw new Error('orderCancel failed');
}