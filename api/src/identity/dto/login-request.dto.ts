import type { LoginRequest } from '@mes/contracts';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { LOGIN_USERNAME_MAX_LENGTH, normaliseUsername, PASSWORD_MAX_LENGTH } from '../credential-rules';

type Input = { value: unknown };

/**
 * Deliberately looser than registration (ADR 026): anything that could not be a real
 * username or password is answered 401 like any other mismatch, not 400.
 */
export class LoginRequestDto implements LoginRequest {
  @Transform(({ value }: Input) => (typeof value === 'string' ? normaliseUsername(value) : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(LOGIN_USERNAME_MAX_LENGTH)
  username!: string;

  // Not trimmed or altered. The cap bounds the work of hashing it.
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}
