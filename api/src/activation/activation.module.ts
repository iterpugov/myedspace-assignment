import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { LmsModule } from '../lms/lms.module';
import { ActivationController } from './activation.controller';
import { ActivationService } from './activation.service';
import { CourseAdditionService } from './course-addition.service';
import { OnboardingService } from './onboarding.service';
import { RedemptionController } from './redemption.controller';
import { RedemptionSteps } from './redemption-steps';

@Module({
  imports: [IdentityModule, LmsModule],
  controllers: [ActivationController, RedemptionController],
  providers: [ActivationService, RedemptionSteps, OnboardingService, CourseAdditionService],
  exports: [ActivationService],
})
export class ActivationModule {}
