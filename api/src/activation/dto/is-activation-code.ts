import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import {
  ACTIVATION_CODE_MAX_INPUT_LENGTH,
  isWellFormedActivationCode,
  NORMALISED_ACTIVATION_CODE,
  normaliseActivationCode,
} from '../activation-code';

/** An activation code in a request body: normalised when well formed, rejected otherwise. */
export function IsActivationCode(): PropertyDecorator {
  return applyDecorators(
    // Only something shaped like a code is normalised; anything else is left as it came and fails below.
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' && isWellFormedActivationCode(value) ? normaliseActivationCode(value) : value,
    ),
    IsString(),
    MaxLength(ACTIVATION_CODE_MAX_INPUT_LENGTH),
    Matches(NORMALISED_ACTIVATION_CODE, { message: 'code must be a well-formed activation code' }),
  );
}
