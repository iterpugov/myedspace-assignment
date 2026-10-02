import { CODE_INPUT_MAX_LENGTH } from './activation-code-rules';

/** Router state that carries an activation code from the link to "Add a course" (ADR 029). */
export interface CarriedActivationCode {
  activationCode: string;
}

/**
 * The activation code carried in router state, or an empty string. History state survives
 * reloads and can be written by any script of the page, so its shape is checked, not assumed.
 */
export function carriedActivationCode(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('activationCode' in state)) return '';
  const { activationCode } = state;
  return typeof activationCode === 'string' && activationCode.length <= CODE_INPUT_MAX_LENGTH ? activationCode : '';
}
