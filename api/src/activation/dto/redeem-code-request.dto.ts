import type { RedeemCodeRequest } from '@mes/contracts';
import { IsActivationCode } from './is-activation-code';

/** The student is the one in the session; the body can name nobody. */
export class RedeemCodeRequestDto implements RedeemCodeRequest {
  @IsActivationCode()
  code!: string;
}
