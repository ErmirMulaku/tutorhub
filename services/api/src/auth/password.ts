import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Dependency-free password hashing using Node's scrypt. Stored as
 * `salt:derivedKey` (both hex). Real deployments would use a tuned bcrypt/argon2,
 * but this keeps the marketplace demo free of native build steps.
 */
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEYLEN).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (salt === undefined || key === undefined) return false;
  const derived = scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(key, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
