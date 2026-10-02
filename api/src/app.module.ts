import { Module } from '@nestjs/common';
import { ActivationModule } from './activation/activation.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { CheckoutModule } from './checkout/checkout.module';
import { IdentityModule } from './identity/identity.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, CatalogueModule, CheckoutModule, ActivationModule, IdentityModule],
})
export class AppModule {}
