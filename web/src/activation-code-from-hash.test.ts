import { activationCodeFromHash } from './activation-code-from-hash';

describe('activationCodeFromHash', () => {
  it('returns the code from #code=<code> (ONB-1, ADR 020)', () => {
    expect(activationCodeFromHash('#code=ABCDE-FGHJK-MNPQR')).toBe('ABCDE-FGHJK-MNPQR');
  });

  it.each([
    ['an empty fragment', ''],
    ['a bare #', '#'],
    ['a fragment without a code key', '#section=pricing'],
    ['a code key with no value', '#code='],
    ['a value longer than 64 characters', `#code=${'A'.repeat(65)}`],
  ])('returns an empty string for %s', (_case, hash) => {
    expect(activationCodeFromHash(hash)).toBe('');
  });

  it('still returns a value of exactly 64 characters', () => {
    const longest = 'A'.repeat(64);

    expect(activationCodeFromHash(`#code=${longest}`)).toBe(longest);
  });
});
