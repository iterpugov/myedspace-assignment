import { Body, Controller, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { RedeemCodeResponse } from '@mes/contracts';
import { CurrentStudentId, SessionGuard } from '../identity/session.guard';
import { CourseAdditionService } from './course-addition.service';
// A value import: the validation pipe needs the class at run time.
import { RedeemCodeRequestDto } from './dto/redeem-code-request.dto';

/**
 * Redeeming a code for the signed-in student. A class of its own with the guard on it, so
 * a guarded route cannot be left open by being added next to the anonymous onboarding one.
 */
@Controller('redemptions')
@UseGuards(SessionGuard)
export class RedemptionController {
  constructor(private readonly courseAddition: CourseAdditionService) {}

  /** Adds the code's course to the student's account. 200, not 201: a repeat answers the same. */
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  redeem(@CurrentStudentId() studentId: string, @Body() body: RedeemCodeRequestDto): Promise<RedeemCodeResponse> {
    return this.courseAddition.addCourse(studentId, body.code);
  }
}
