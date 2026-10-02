import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

interface ScryptParameters {
  N: number;
  r: number;
  p: number;
}

const SCHEME = 'scrypt';
/** Used for new hashes. Stored hashes carry their own parameters, so these can be raised later. */
const CURRENT: ScryptParameters = { N: 32768, r: 8, p: 3 };
const SALT_BYTES = 16;
const KEY_BYTES = 64;

function deriveKey(password: string, salt: Buffer, keyLength: number, parameters: ScryptParameters): Promise<Buffer> {
  // scrypt needs about 128 * N * r bytes; Node's default limit is too low for N = 32768.
  const maxmem = 256 * parameters.N * parameters.r;
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, { ...parameters, maxmem }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/** Returns `scrypt$N=…,r=…,p=…$<salt>$<hash>`, salt and hash in base64. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt, KEY_BYTES, CURRENT);
  const { N, r, p } = CURRENT;
  return `${SCHEME}$N=${N},r=${r},p=${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function parseParameters(text: string): ScryptParameters | undefined {
  const match = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(text);
  if (!match) return undefined;
  const [N, r, p] = match.slice(1).map(Number);
  const isPowerOfTwo = N > 1 && (N & (N - 1)) === 0;
  // The upper bounds keep a corrupted row from turning one login into a huge computation.
  return isPowerOfTwo && N <= 2 ** 17 && r >= 1 && r <= 8 && p >= 1 && p <= 4 ? { N, r, p } : undefined;
}

/** Whether the password matches a stored hash. A stored value that cannot be read never matches. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== SCHEME) return false;

  const parameters = parseParameters(parts[1]);
  const salt = Buffer.from(parts[2], 'base64');
  const expected = Buffer.from(parts[3], 'base64');
  if (!parameters || salt.length === 0 || expected.length !== KEY_BYTES) return false;

  try {
    const actual = await deriveKey(password, salt, expected.length, parameters);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * A well-formed hash that no password matches: the hash of random bytes, made once per
 * process. Login verifies against it when the username is unknown, so that answer costs
 * one scrypt run like a wrong password does (ADR 026).
 */
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(32).toString('base64')).catch((error: unknown) => {
    // Not remembered: a failure here must not turn every unknown username into an error.
    dummyHash = undefined;
    throw error;
  });
  return dummyHash;
}
