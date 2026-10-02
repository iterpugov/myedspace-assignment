import { resolveSessionSecret } from './session-secret';

describe('Session signing secret (ADR 024)', () => {
  it('returns a configured secret of 32 or more characters as is', () => {
    const exactly32 = 's'.repeat(32);
    const longer = 'configured-test-value-'.repeat(3);

    expect(resolveSessionSecret(exactly32)).toBe(exactly32);
    expect(resolveSessionSecret(longer)).toBe(longer);
  });

  it.each([
    ['31 characters', 's'.repeat(31)],
    ['one character', 's'],
  ])('throws for a configured secret shorter than 32 characters: %s', (_name, configured) => {
    expect(() => resolveSessionSecret(configured)).toThrow();
  });

  it('does not put the rejected secret into the error message', () => {
    const tooShort = 'short-configured-value';

    let message = '';
    try {
      resolveSessionSecret(tooShort);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toBe('');
    expect(message).not.toContain(tooShort);
  });

  it.each([
    ['undefined', undefined],
    ['an empty string', ''],
  ])('returns a random secret of at least 32 characters when the configured value is %s', (_name, configured) => {
    const secret = resolveSessionSecret(configured);

    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThanOrEqual(32);
  });

  it('returns a different value on each call when no secret is configured', () => {
    const secrets = Array.from({ length: 20 }, () => resolveSessionSecret(undefined));

    expect(new Set(secrets).size).toBe(20);
  });
});
