/**
 * Purpose: build concise human strings from Shopify data and a strict ≤100‑char BOLT11 memo.
 * Called by: webhooks (summary); invoices (memo).
 */
export function toTitleish(s: string): string {
  const clean = String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return clean.replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}
export function asciiClean(s: string): string {
  return String(s || '').replace(/[^\x20-\x7E]/g, '');
}
export function summarizeLineItems(items: Array<{ title?: string; variant_title?: string; quantity?: number }>): string {
  const parts = (Array.isArray(items) ? items : []).map((x) => {
    const qty = Number(x?.quantity || 0);
    const title = toTitleish(x?.title || '');
    const variant = toTitleish(x?.variant_title || '');
    const name = variant ? `${title} (${variant})` : title;
    return `${qty}× ${name}`.trim();
  }).filter(Boolean);
  const head = parts.slice(0, 3).join(', ');
  return parts.length > 3 ? `${head}, +${parts.length - 3} more` : head;
}
export function buildOrderSummaryFromWebhookPayload(payload: any): string {
  const list = summarizeLineItems(payload?.line_items || []);
  const total = String(payload?.current_total_price || payload?.total_price || '').trim();
  const cur = String(payload?.currency || '').toUpperCase();
  const label = String(payload?.name || `#${payload?.order_number || ''}`).trim();
  const right = [list, total && cur ? `${total} ${cur}` : total || cur].filter(Boolean).join(' — ');
  return [label || '', right].filter(Boolean).join(' — ');
}
export function buildBolt11Memo(args: { orderName?: string; desc?: string; amount?: number; currency?: string }): string {
  // Use desc (order summary) as the primary content, keep under 100 chars
  const descRaw = (args.desc && String(args.desc).trim()) || '';
  const descBase = asciiClean(descRaw).trim();
  
  if (descBase) {
    // If we have a summary, use it directly (already includes order name from webhook)
    return descBase.length > 100 ? descBase.slice(0, 100) : descBase;
  }
  
  // Fallback: build from components
  const prefix = args.orderName && String(args.orderName).trim() ? `Shopify ${String(args.orderName).trim()}` : 'Shopify';
  const fallback = (args.amount && args.currency) ? `${args.amount} ${String(args.currency).toUpperCase()}` : '';
  const out = fallback ? `${prefix} — ${fallback}` : prefix;
  return out.length > 100 ? out.slice(0, 100) : out;
}