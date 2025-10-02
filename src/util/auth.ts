/**
 * Purpose: Basic auth checks for developer area and merchant portal.
 * Called by: dev router; merchant router.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function basicOk(auth?: string, expectedUser?: string, expectedPass?: string): boolean {
  const envUser = expectedUser ?? process.env.DEVELOPER_BASIC_USER ?? '';
  const envPass = expectedPass ?? process.env.DEVELOPER_PASSWORD ?? '';
  if (!auth?.startsWith('Basic ')) return false;
  const [u, p] = Buffer.from(auth.slice(6), 'base64').toString('utf8').split(':');
  if (!u || !p) return false;
  return safeEqual(u, envUser) && safeEqual(p, envPass);
}

export function merchantOk(auth?: string, expectUser?: string, passwordHash?: string): boolean {
  const logger = require('./logger').logger;
  
  logger.info('merchantOk called', {
    authPresent: !!auth,
    expectUser,
    passwordHashPresent: !!passwordHash
  });
  
  if (!auth?.startsWith('Basic ')) {
    logger.warn('No Basic auth header provided');
    return false;
  }
  
  try {
    const [u, p] = Buffer.from(auth.slice(6), 'base64').toString('utf8').split(':');
    logger.info('Basic auth decoded', {
      providedUser: u,
      expectedUser: expectUser,
      passwordProvided: !!p
    });
    
    if (u !== expectUser) {
      logger.warn('Username mismatch', { provided: u, expected: expectUser });
      return false;
    }
    
    const bcrypt = require('bcryptjs');
    const result = bcrypt.compareSync(p, passwordHash || '');
    logger.info('Password check result', { result });
    return result;
  } catch (error) {
    logger.error('Error in merchantOk', { error: String(error) });
    return false;
  }
}