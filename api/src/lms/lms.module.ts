import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { IdentityModule } from '../identity/identity.module';
import { EnrolmentService } from './enrolment.service';
import { LearningService } from './learning.service';
import { LmsController } from './lms.controller';

@Module({
  // IdentityModule provides the SessionService that SessionGuard needs.
  imports: [IdentityModule, CatalogueModule],
  controllers: [LmsController],
  providers: [EnrolmentService, LearningService],
  exports: [EnrolmentService],
})
export class LmsModule {}
