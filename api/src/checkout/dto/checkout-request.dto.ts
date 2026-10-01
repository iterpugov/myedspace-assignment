import type { CheckoutRequest, CheckoutSeatRequest } from '@mes/contracts';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CheckoutSeatDto implements CheckoutSeatRequest {
  // Course ids are stored in lower case; accept either so the lookup does not miss.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsUUID()
  courseId!: string;

  /** Only the shape is checked here; the course's own range is a business rule (422). */
  @IsInt()
  year!: number;
}

export class CheckoutRequestDto implements CheckoutRequest {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  // PostgreSQL cannot store a NUL in text; refuse control characters here, before anything is charged.
  @Matches(/^\P{Cc}*$/u)
  parentName!: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  parentEmail!: string;

  // Without @ValidateNested and @Type the seats would pass through unchecked, and without
  // @IsObject a seat that is itself an array would be validated element by element.
  @IsArray()
  @IsObject({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CheckoutSeatDto)
  seats!: CheckoutSeatDto[];
}
