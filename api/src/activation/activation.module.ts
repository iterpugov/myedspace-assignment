import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { LmsModule } from '../lms/lms.module';
import { ActivationController } from './activation.controller';
import { ActivationService } from './activation.service';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [IdentityModule, LmsModule],
  controllers: [ActivationController],
  providers: [ActivationService, OnboardingService],
  exports: [ActivationService],
})
export class ActivationModule {}
