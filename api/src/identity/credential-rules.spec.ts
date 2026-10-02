import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, isValidUsername, normaliseUsername } from './credential-rules';

describe('Credential rules (ADR 023)', () => {
  describe('normaliseUsername', () => {
    it('trims and lower-cases', () => {
      expect(normaliseUsername('  Sam_07 \n')).toBe('sam_07');
    });

    it('leaves an already normalised username unchanged', () => {
      expect(normaliseUsername('sam_07')).toBe('sam_07');
    });
  });

  describe('isValidUsername', () => {
    it.each([
      ['three letters', 'sam'],
      ['letters, an underscore and digits', 'sam_07'],
      ['digits only', '123'],
      ['20 characters', 'a'.repeat(20)],
    ])('accepts %s', (_name, username) => {
      expect(isValidUsername(username)).toBe(true);
    });

    it.each([
      ['an empty string', ''],
      ['2 characters', 'sa'],
      ['21 characters', 'a'.repeat(21)],
      ['a space', 'sam smith'],
      ['an @', 'sam@home'],
      ['a hyphen', 'sam-07'],
      ['a non-ASCII letter', 'sám'],
      ['an upper-case letter (not normalised)', 'Sam'],
      ['a trailing newline', 'sam\n'],
    ])('rejects %s', (_name, username) => {
      expect(isValidUsername(username)).toBe(false);
    });
  });

  it('bounds the password length at 8 to 128 characters', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });
});
