/**
 * Purpose: fetch BTC/fiat map; 30s cache.
 * Called by: invoice creation (fiat→msat), merchant UI display.
 */
type RatesMap = Record<string, number>;
let cache: { ts: number; map: RatesMap } = { ts: 0, map: {} };

async function fetchMap(url: string): Promise<RatesMap> {
  const res = await fetch(url, { method: 'GET' } as any);
  if (!res.ok) throw new Error(`rates http ${res.status}`);
  const j = await res.json() as any;
  const obj = j?.bitcoin;
  if (!obj || typeof obj !== 'object') throw new Error('rates shape');
  const m: RatesMap = {};
  for (const [k, v] of Object.entries(obj)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) m[k.toLowerCase()] = n;
  }
  return m;
}

async function loadRates(): Promise<RatesMap> {
  const now = Date.now();
  if (now - cache.ts < 30000 && Object.keys(cache.map).length) return cache.map;
  const primary = process.env.EXCHANGE_RATE_ENDPOINT_PRIMARY || '';
  const secondary = process.env.EXCHANGE_RATE_ENDPOINT_SECONDARY || '';
  let map: RatesMap | null = null;
  if (primary) { try { map = await fetchMap(primary); } catch {} }
  if (!map && secondary) { try { map = await fetchMap(secondary); } catch {} }
  if (!map) throw new Error('no-rates');
  cache = { ts: now, map };
  return map;
}

export async function fiatToMsat(amount: number, currency?: string): Promise<bigint> {
  const cur = (currency || process.env.CURRENCY || 'USD').toLowerCase();
  const price = (await loadRates())[cur];
  if (!price) throw new Error(`rate-missing-${cur}`);
  const btc = amount / price;
  return BigInt(Math.round(btc * 100_000_000 * 1000));
}

export async function btcPrice(currency?: string): Promise<number> {
  const cur = (currency || process.env.CURRENCY || 'USD').toLowerCase();
  const price = (await loadRates())[cur];
  if (!price) throw new Error(`rate-missing-${cur}`);
  return price;
}