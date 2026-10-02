import type { ActivationFailureReason, ActivationRequest, StudentResponse } from '@mes/contracts';

// Written as a record so that a reason added to the contract fails to compile here.
const REASONS = Object.keys({
  code_invalid: true,
  code_used: true,
  username_taken: true,
} satisfies Record<ActivationFailureReason, true>) as ActivationFailureReason[];

/** The API refused or failed the activation; `reason` is set when it said why. */
export class ActivationError extends Error {
  constructor(
    readonly status: number,
    readonly reason?: ActivationFailureReason,
  ) {
    super(`Activation failed with status ${status}`);
  }
}

/** The failure reason in an error body, if the body is JSON and names one we know. */
async function reasonOf(response: Response): Promise<ActivationFailureReason | undefined> {
  try {
    const body: unknown = await response.json();
    const reason = typeof body === 'object' && body !== null && 'reason' in body ? body.reason : undefined;
    return REASONS.find((known) => known === reason);
  } catch {
    return undefined;
  }
}

export async function activate(request: ActivationRequest): Promise<StudentResponse> {
  const response = await fetch('/api/activations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new ActivationError(response.status, await reasonOf(response));
  }
  return (await response.json()) as StudentResponse;
}
