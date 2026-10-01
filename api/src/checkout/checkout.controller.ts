import { Body, Controller, Header, Post } from '@nestjs/common';
import type { CheckoutResponse } from '@mes/contracts';
import { CheckoutService } from './checkout.service';
// A value import: the validation pipe needs the class at run time.
import { CheckoutRequestDto } from './dto/checkout-request.dto';

@Controller('orders')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  // The response carries plain activation codes; nothing may keep a copy.
  @Header('Cache-Control', 'no-store')
  create(@Body() body: CheckoutRequestDto): Promise<CheckoutResponse> {
    return this.checkout.checkout(body);
  }
}
