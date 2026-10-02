import type { ActivationRequest } from '@mes/contracts';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  normaliseUsername,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_PATTERN,
} from '../../identity/credential-rules';
import {
  ACTIVATION_CODE_MAX_INPUT_LENGTH,
  isWellFormedActivationCode,
  NORMALISED_ACTIVATION_CODE,
  normaliseActivationCode,
} from '../activation-code';

type Input = { value: unknown };

export class ActivationRequestDto implements ActivationRequest {
  // Only something shaped like a code is normalised; anything else is left as it came and fails below.
  @Transform(({ value }: Input) => 
    typeof value === 'string' && isWellFormedActivationCode(value) ? normaliseActivationCode(value) : value,
  )
  @IsString()
  @MaxLength(ACTIVATION_CODE_MAX_INPUT_LENGTH)
  @Matches(NORMALISED_ACTIVATION_CODE, { message: 'code must be a well-formed activation code' })
  code!: string;

  @Transform(({ value }: Input) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^\P{Cc}*$/u, { message: 'firstName must not contain control characters' })
  firstName!: string;

  @Transform(({ value }: Input) => (typeof value === 'string' ? normaliseUsername(value) : value))
  @IsString()
  @Matches(USERNAME_PATTERN, { message: 'username must be 3–20 characters: letters, digits or underscores' })
  username!: string;

  // Not trimmed or altered: the student gets exactly the password they typed.
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}
