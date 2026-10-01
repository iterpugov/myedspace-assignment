import { Module } from '@nestjs/common';
import { ActivationModule } from '../activation/activation.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { MockPaymentGateway } from './payment/mock-payment-gateway';
import { PAYMENT_GATEWAY } from './payment/payment-gateway';

@Module({
  imports: [CatalogueModule, ActivationModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, { provide: PAYMENT_GATEWAY, useClass: MockPaymentGateway }],
})
export class CheckoutModule {}
