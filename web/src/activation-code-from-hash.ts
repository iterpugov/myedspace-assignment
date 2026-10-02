/** Longest value worth accepting from a link; a real code with hyphens is 17 characters. */
const MAX_LENGTH = 64;

/** The activation code carried by a link's fragment (`#code=…`), or '' if there is none. */
export function activationCodeFromHash(hash: string): string {
  const code = new URLSearchParams(hash.replace(/^#/, '')).get('code') ?? '';
  return code.length <= MAX_LENGTH ? code : '';
}
