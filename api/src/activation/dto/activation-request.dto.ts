import type { ActivationRequest } from '@mes/contracts';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  normaliseUsername,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_PATTERN,
} from '../../identity/credential-rules';
import { IsActivationCode } from './is-activation-code';

type Input = { value: unknown };

export class ActivationRequestDto implements ActivationRequest {
  @IsActivationCode()
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
