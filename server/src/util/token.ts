import { createHash, randomBytes } from 'node:crypto';

/** Opaque bearer token handed to the client once at guest login. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What we actually store: sha256 of the token. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
