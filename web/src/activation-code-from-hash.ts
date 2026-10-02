import { CODE_INPUT_MAX_LENGTH } from './activation-code-rules';

/** The activation code carried by a link's fragment (`#code=…`), or '' if there is none. */
export function activationCodeFromHash(hash: string): string {
  const code = new URLSearchParams(hash.replace(/^#/, '')).get('code') ?? '';
  return code.length <= CODE_INPUT_MAX_LENGTH ? code : '';
}
