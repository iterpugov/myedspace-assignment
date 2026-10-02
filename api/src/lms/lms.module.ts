import { Module } from '@nestjs/common';
import { EnrolmentService } from './enrolment.service';

@Module({
  providers: [EnrolmentService],
  exports: [EnrolmentService],
})
export class LmsModule {}
