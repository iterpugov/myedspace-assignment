import { randomBytes, scryptSync } from 'node:crypto';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password';

/** Obviously fake; never a real credential. */
const FAKE_PASSWORD = 'not-a-real-password';
const STORED = /^scrypt\$N=32768,r=8,p=3\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/;

describe('Password hashing (ADR 008, scrypt)', () => {
  describe('hashPassword', () => {
    it('returns scrypt$N=32768,r=8,p=3$<salt>$<hash> with a 16-byte salt and a 64-byte key, without the password', async () => {
      const stored = await hashPassword(FAKE_PASSWORD);

      expect(stored).toMatch(STORED);
      expect(stored).not.toContain(FAKE_PASSWORD);
      const [, salt, hash] = STORED.exec(stored) ?? [];
      expect(Buffer.from(salt, 'base64')).toHaveLength(16);
      expect(Buffer.from(hash, 'base64')).toHaveLength(64);
    });

    it('stores the scrypt key of the password under the parameters it names', async () => {
      const stored = await hashPassword(FAKE_PASSWORD);

      const [, salt, hash] = STORED.exec(stored) ?? [];
      const expected = scryptSync(FAKE_PASSWORD, Buffer.from(salt, 'base64'), 64, {
        N: 32768,
        r: 8,
        p: 3,
        maxmem: 64 * 1024 * 1024,
      });
      expect(hash).toBe(expected.toString('base64'));
    });

    it('gives two different strings for the same password hashed twice', async () => {
      const [first, second] = await Promise.all([hashPassword(FAKE_PASSWORD), hashPassword(FAKE_PASSWORD)]);

      expect(first).not.toBe(second);
    });
  });

  describe('verifyPassword', () => {
    it('is true for the right password and false for a wrong one', async () => {
      const stored = await hashPassword(FAKE_PASSWORD);

      await expect(verifyPassword(FAKE_PASSWORD, stored)).resolves.toBe(true);
      await expect(verifyPassword(`${FAKE_PASSWORD}x`, stored)).resolves.toBe(false);
      await expect(verifyPassword(FAKE_PASSWORD.toUpperCase(), stored)).resolves.toBe(false);
      await expect(verifyPassword('', stored)).resolves.toBe(false);
    });

    it.each([
      ['an empty string', ''],
      ['a value without separators', 'not-a-hash'],
      ['another scheme', 'bcrypt$N=32768,r=8,p=3$AAAA$AAAA'],
      ['a missing hash part', 'scrypt$N=32768,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA=='],
      ['a missing parameter', 'scrypt$N=32768,r=8$AAAAAAAAAAAAAAAAAAAAAA==$AAAA'],
      ['a non-numeric parameter', 'scrypt$N=abc,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA==$AAAA'],
      ['a cost that is not a power of two', 'scrypt$N=3,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA'],
      ['an empty hash part', 'scrypt$N=32768,r=8,p=3$AAAAAAAAAAAAAAAAAAAAAA==$'],
      ['too many parts', 'scrypt$N=32768,r=8,p=3$AAAA$AAAA$AAAA'],
    ])('returns false, without throwing, for a malformed stored value: %s', async (_name, stored) => {
      await expect(verifyPassword(FAKE_PASSWORD, stored)).resolves.toBe(false);
    });

    it('still verifies a stored hash made with other parameters (N=16384, p=1)', async () => {
      const salt = randomBytes(16);
      const key = scryptSync(FAKE_PASSWORD, salt, 64, { N: 16384, r: 8, p: 1 });
      const stored = `scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${key.toString('base64')}`;

      await expect(verifyPassword(FAKE_PASSWORD, stored)).resolves.toBe(true);
      await expect(verifyPassword(`${FAKE_PASSWORD}x`, stored)).resolves.toBe(false);
    });
  });

  describe('dummyPasswordHash (ADR 026: an unknown username still costs one scrypt run)', () => {
    it('has the stored-hash format with the current parameters, a 16-byte salt and a 64-byte key, so verifyPassword cannot return early on it', async () => {
      const dummy = await dummyPasswordHash();

      expect(dummy).toMatch(STORED);
      const [, salt, hash] = STORED.exec(dummy) ?? [];
      expect(Buffer.from(salt, 'base64')).toHaveLength(16);
      expect(Buffer.from(hash, 'base64')).toHaveLength(64);
      // Made once, when first asked for: every login compares against the same value.
      await expect(dummyPasswordHash()).resolves.toBe(dummy);
    });

    it('never matches: verifyPassword(<anything>, dummy) is false', async () => {
      const dummy = await dummyPasswordHash();

      await expect(verifyPassword(FAKE_PASSWORD, dummy)).resolves.toBe(false);
      await expect(verifyPassword('', dummy)).resolves.toBe(false);
      await expect(verifyPassword(dummy, dummy)).resolves.toBe(false);
    });
  });
});
