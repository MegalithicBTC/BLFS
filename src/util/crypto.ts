/**
 * Purpose: encrypt/decrypt secrets at rest (AES-256-GCM) via MASTER_KEY.
 * Used by: entity transformers; storing Shopify/NWC secrets.
 */
import crypto from 'crypto';

const RAW = process.env.MASTER_KEY || '';
const KEY = (() => {
  if (!RAW) throw new Error('MASTER_KEY required');
  if (/^[A-Fa-f0-9]{64}$/.test(RAW)) return Buffer.from(RAW, 'hex');
  if (/^[A-Za-z0-9+/=]+$/.test(RAW)) return Buffer.from(RAW, 'base64');
  if (RAW.length === 32) return Buffer.from(RAW, 'utf8');
  throw new Error('MASTER_KEY must be 32 bytes (hex/base64/utf8)');
})();

export function encryptString(plain?: string | null): string | null {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${Buffer.concat([iv, tag, enc]).toString('base64')}`;
}

export function decryptString(blob?: string | null): string | null {
  if (!blob) return null;
  if (!String(blob).startsWith('v1:')) throw new Error('unknown secret format');
  const buf = Buffer.from(String(blob).slice(3), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

export const encryptedText = { to: (v?: string | null) => encryptString(v), from: (v?: string | null) => decryptString(v) };

export function randomPassword(): string { return crypto.randomBytes(18).toString('base64url'); }
export function randomId(): string { return crypto.randomBytes(16).toString('hex'); }