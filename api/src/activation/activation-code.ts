import { createHash, randomBytes } from 'node:crypto';

/** 32 symbols, so each carries 5 bits; I, O, 0 and 1 are left out as easy to confuse. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GROUPS = 3;
const GROUP_LENGTH = 5;

/** A new random code shaped XXXXX-XXXXX-XXXXX (75 bits). */
export function generateActivationCode(): string {
  // 256 is a multiple of 32, so masking a random byte picks every symbol equally often.
  const symbols = Array.from(randomBytes(GROUPS * GROUP_LENGTH), (byte) => ALPHABET[byte & 31]);
  return Array.from({ length: GROUPS }, (_, group) =>
    symbols.slice(group * GROUP_LENGTH, (group + 1) * GROUP_LENGTH).join(''),
  ).join('-');
}

/** The form a code is hashed in: upper case, without hyphens or whitespace. */
export function normaliseActivationCode(code: string): string {
  return code.replace(/[-\s]/g, '').toUpperCase();
}

/** A code in the form it is hashed in. */
export const NORMALISED_ACTIVATION_CODE = new RegExp(`^[${ALPHABET}]{${GROUPS * GROUP_LENGTH}}$`);
/** Longest input worth normalising; a real code with hyphens is 17 characters. */
export const ACTIVATION_CODE_MAX_INPUT_LENGTH = 64;

/** Whether the input could be a code at all. Checked before hashing, so junk never reaches the database. */
export function isWellFormedActivationCode(input: unknown): boolean {
  return (
    typeof input === 'string' &&
    input.length <= ACTIVATION_CODE_MAX_INPUT_LENGTH &&
    NORMALISED_ACTIVATION_CODE.test(normaliseActivationCode(input))
  );
}

/**
 * What is stored instead of the code. A plain SHA-256 is enough because the code is
 * random with 75 bits of entropy; a slow password hash would add nothing.
 */
export function hashActivationCode(code: string): string {
  return createHash('sha256').update(normaliseActivationCode(code)).digest('hex');
}
