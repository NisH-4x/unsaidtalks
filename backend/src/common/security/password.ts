import { compare, hash } from 'bcryptjs';

const BCRYPT_COST = 12;

export function hashPassword(plainText: string): Promise<string> {
  return hash(plainText, BCRYPT_COST);
}

export function verifyPassword(plainText: string, passwordHash: string): Promise<boolean> {
  return compare(plainText, passwordHash);
}
