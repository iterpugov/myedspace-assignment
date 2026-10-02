import type {
  ActivationFailureReason,
  ActivationRequest,
  RedeemCodeRequest,
  RedeemCodeResponse,
  RedemptionFailureReason,
  StudentResponse,
} from '@mes/contracts';

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

/** The failure reason in an error body, if the body is JSON and names one of `known`. */
async function reasonOf<Reason extends string>(response: Response, known: Reason[]): Promise<Reason | undefined> {
  try {
    const body: unknown = await response.json();
    const reason = typeof body === 'object' && body !== null && 'reason' in body ? body.reason : undefined;
    return known.find((candidate) => candidate === reason);
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
    throw new ActivationError(response.status, await reasonOf(response, REASONS));
  }
  return (await response.json()) as StudentResponse;
}

const REDEMPTION_REASONS = Object.keys({
  code_invalid: true,
  code_used: true,
  course_already_owned: true,
} satisfies Record<RedemptionFailureReason, true>) as RedemptionFailureReason[];

/** The API refused or failed adding a course; 401 means the session has ended. */
export class RedemptionError extends Error {
  constructor(
    readonly status: number,
    readonly reason?: RedemptionFailureReason,
  ) {
    super(`Adding the course failed with status ${status}`);
  }
}

/** Adds the code's course to the signed-in student's account. */
export async function redeemCode(request: RedeemCodeRequest): Promise<RedeemCodeResponse> {
  const response = await fetch('/api/redemptions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new RedemptionError(response.status, await reasonOf(response, REDEMPTION_REASONS));
  }
  return (await response.json()) as RedeemCodeResponse;
}
