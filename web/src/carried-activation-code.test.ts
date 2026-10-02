import { carriedActivationCode } from './carried-activation-code';

/** Not a real code: a made-up value in the code alphabet. */
const activationCode = 'ABCDE-FGHJK-MNPQR';

describe('carriedActivationCode', () => {
  it('returns the code from router state of the shape { activationCode } (ADR 029)', () => {
    expect(carriedActivationCode({ activationCode })).toBe(activationCode);
  });

  it.each<[string, unknown]>([
    ['null, the state of an entry opened directly', null],
    ['undefined', undefined],
    ['an object without the key', {}],
    ['an object with another key', { code: activationCode }],
    ['a bare string', activationCode],
    ['a number', 42],
    ['an array holding the code', [activationCode]],
    ['a code that is a number', { activationCode: 123456789012345 }],
    ['a code that is null', { activationCode: null }],
    ['a code that is an array', { activationCode: [activationCode] }],
    ['a code that is an object', { activationCode: { activationCode } }],
    ['a code longer than 64 characters', { activationCode: 'A'.repeat(65) }],
  ])('returns an empty string for %s', (_case, state) => {
    expect(carriedActivationCode(state)).toBe('');
  });

  it('still returns a value of exactly 64 characters', () => {
    const longest = 'A'.repeat(64);

    expect(carriedActivationCode({ activationCode: longest })).toBe(longest);
  });

  it('ignores other keys next to the code', () => {
    expect(carriedActivationCode({ activationCode, from: '/activate' })).toBe(activationCode);
  });
});
