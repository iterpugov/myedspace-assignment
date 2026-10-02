// The same shape the API enforces; here it only saves a round trip.
const NORMALISED_CODE = /^[A-HJ-NP-Z2-9]{15}$/;

export const CODE_REQUIRED = 'Enter your activation code';
export const CODE_INVALID = 'This activation code is not valid. Check it and try again.';

/** Form validation of an activation code field: true, or the message to show under it. */
export function validateActivationCode(value: string): true | string {
  if (value.trim() === '') return CODE_REQUIRED;
  return NORMALISED_CODE.test(value.replace(/[-\s]/g, '').toUpperCase()) || CODE_INVALID;
}
