import { activationLink } from './activation-link';

describe('activationLink', () => {
  it("builds the link on the SPA's origin with the code in the fragment, not the query (ADR 020)", () => {
    const link = activationLink('ABCDE-FGHJK-MNPQR');

    expect(link).toBe(`${window.location.origin}/activate#code=ABCDE-FGHJK-MNPQR`);
    const url = new URL(link);
    expect(url.pathname).toBe('/activate');
    expect(url.search).toBe('');
    expect(url.hash).toBe('#code=ABCDE-FGHJK-MNPQR');
  });
});
