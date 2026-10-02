import { createHash } from 'node:crypto';
import { generateActivationCode, hashActivationCode, normaliseActivationCode } from './activation-code';
import { isWellFormedActivationCode } from './activation-code';

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){2}$/;

describe('Activation code (ADR 009)', () => {
  describe('generateActivationCode', () => {
    it('returns a code shaped XXXXX-XXXXX-XXXXX from the unambiguous alphabet', () => {
      expect(generateActivationCode()).toMatch(CODE_PATTERN);
    });

    it('gives 1,000 different codes, none containing I, O, 0 or 1', () => {
      const codes = Array.from({ length: 1000 }, () => generateActivationCode());

      expect(new Set(codes).size).toBe(1000);
      for (const code of codes) {
        expect(code).toMatch(CODE_PATTERN);
        expect(code).not.toMatch(/[IO01]/);
      }
    });
  });

  describe('normaliseActivationCode', () => {
    it('upper-cases and strips hyphens and surrounding whitespace', () => {
      expect(normaliseActivationCode('  abcde-fghjk-mnpqr \n')).toBe('ABCDEFGHJKMNPQR');
    });

    it('leaves an already normalised code unchanged', () => {
      expect(normaliseActivationCode('ABCDEFGHJKMNPQR')).toBe('ABCDEFGHJKMNPQR');
    });
  });

  describe('hashActivationCode', () => {
    it('returns 64 lower-case hex characters and not the code itself', () => {
      const code = 'ABCDE-FGHJK-MNPQR';

      const hash = hashActivationCode(code);

      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).not.toContain(code);
      expect(hash.toUpperCase()).not.toContain('ABCDEFGHJKMNPQR');
    });

    it('is the same for the hyphenated, lower-case and normalised forms of one code', () => {
      const hyphenated = hashActivationCode('ABCDE-FGHJK-MNPQR');

      expect(hashActivationCode('abcde-fghjk-mnpqr')).toBe(hyphenated);
      expect(hashActivationCode('ABCDEFGHJKMNPQR')).toBe(hyphenated);
      expect(hashActivationCode('  abcde-fghjk-mnpqr  ')).toBe(hyphenated);
    });

    it('differs for different codes', () => {
      expect(hashActivationCode('ABCDE-FGHJK-MNPQR')).not.toBe(hashActivationCode('ABCDE-FGHJK-MNPQS'));
    });

    it('equals SHA-256 of the normalised code', () => {
      const expected = createHash('sha256').update('ABCDEFGHJKMNPQR').digest('hex');

      expect(hashActivationCode('abcde-fghjk-mnpqr')).toBe(expected);
    });

    it('hashes a generated code to SHA-256 of that code without its hyphens', () => {
      const code = generateActivationCode();
      const expected = createHash('sha256').update(code.replace(/-/g, '')).digest('hex');

      expect(hashActivationCode(code)).toBe(expected);
    });
  });

  describe('isWellFormedActivationCode', () => {
    it.each([
      ['hyphenated', 'ABCDE-FGHJK-MNPQR'],
      ['lower-case', 'abcde-fghjk-mnpqr'],
      ['un-hyphenated', 'ABCDEFGHJKMNPQR'],
      ['surrounded by whitespace', '  ABCDE-FGHJK-MNPQR \n'],
      ['made of the digits 2 to 9 and the last letters', '23456-789XY-ZWVUT'],
    ])('a %s code is well-formed', (_name, input) => {
      expect(isWellFormedActivationCode(input)).toBe(true);
    });

    it('a generated code is well-formed', () => {
      expect(isWellFormedActivationCode(generateActivationCode())).toBe(true);
    });

    it.each([
      ['14 symbols', 'ABCDE-FGHJK-MNPQ'],
      ['16 symbols', 'ABCDE-FGHJK-MNPQRS'],
      ['the letter I', 'ABCDE-FGHJK-MNPQI'],
      ['the letter O', 'ABCDE-FGHJK-MNPQO'],
      ['the digit 0', 'ABCDE-FGHJK-MNPQ0'],
      ['the digit 1', 'ABCDE-FGHJK-MNPQ1'],
      ['a symbol outside the alphabet', 'ABCDE-FGHJK-MNPQ!'],
      ['an empty string', ''],
    ])('%s is not well-formed', (_name, input) => {
      expect(isWellFormedActivationCode(input)).toBe(false);
    });

    it.each<[string, unknown]>([
      ['undefined', undefined],
      ['null', null],
      ['a number', 123456789012345],
      ['an object', { code: 'ABCDE-FGHJK-MNPQR' }],
      ['an array holding a code', ['ABCDE-FGHJK-MNPQR']],
    ])('a non-string (%s) is not well-formed', (_name, input) => {
      expect(isWellFormedActivationCode(input)).toBe(false);
    });

    it('an input longer than 64 characters is not well-formed, even if it normalises to a code', () => {
      const code = 'ABCDE-FGHJK-MNPQR';

      expect(isWellFormedActivationCode(code.padEnd(64, ' '))).toBe(true);
      expect(isWellFormedActivationCode(code.padEnd(65, ' '))).toBe(false);
      expect(isWellFormedActivationCode(code.padEnd(10_000, '-'))).toBe(false);
    });
  });
});
