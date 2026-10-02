import { ConflictException, type HttpException, UnprocessableEntityException } from '@nestjs/common';
import type {
  ActivationErrorResponse,
  ActivationFailureReason,
  RedemptionErrorResponse,
  RedemptionFailureReason,
} from '@mes/contracts';

type RefusalStatus = 409 | 422;

/** A refusal the client can act on: 422 for a rule of the code itself, 409 for a conflict (ADR 023). */
function refusal(body: ActivationErrorResponse | RedemptionErrorResponse): HttpException {
  return body.statusCode === 409 ? new ConflictException(body) : new UnprocessableEntityException(body);
}

/** A refusal of POST /api/activations; only the reasons onboarding can give compile. */
export const onboardingRefusal = (statusCode: RefusalStatus, reason: ActivationFailureReason, message: string) =>
  refusal({ statusCode, message, reason } satisfies ActivationErrorResponse);

/** A refusal of POST /api/redemptions. */
export const redemptionRefusal = (statusCode: RefusalStatus, reason: RedemptionFailureReason, message: string) =>
  refusal({ statusCode, message, reason } satisfies RedemptionErrorResponse);

// Both endpoints give these two, with the same body.
export const codeInvalid = () => onboardingRefusal(422, 'code_invalid', 'This activation code is not valid');
export const codeUsed = () => onboardingRefusal(409, 'code_used', 'This activation code has already been used');
