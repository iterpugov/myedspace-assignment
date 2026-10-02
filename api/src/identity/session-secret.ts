import { randomBytes } from 'node:crypto';

export const SESSION_SECRET_MIN_LENGTH = 32;

/**
 * The key that signs session tokens. No value is committed to the repository (ADR 024):
 * without a configured secret a random one is made, which lasts until the process stops.
 */
export function resolveSessionSecret(configured: string | undefined): string {
  if (!configured) {
    return randomBytes(32).toString('hex');
  }
  if (configured.length < SESSION_SECRET_MIN_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${SESSION_SECRET_MIN_LENGTH} characters long`);
  }
  return configured;
}
