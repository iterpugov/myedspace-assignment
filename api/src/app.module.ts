import { Module } from '@nestjs/common';
import { CatalogueModule } from './catalogue/catalogue.module';
import { CheckoutModule } from './checkout/checkout.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, CatalogueModule, CheckoutModule],
})
export class AppModule {}
