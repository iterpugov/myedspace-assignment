import { Body, Controller, Header, Post, Res } from '@nestjs/common';
import type { StudentResponse } from '@mes/contracts';
import type { Response } from 'express';
import { SessionService } from '../identity/session.service';
// A value import: the validation pipe needs the class at run time.
import { ActivationRequestDto } from './dto/activation-request.dto';
import { OnboardingService } from './onboarding.service';

@Controller('activations')
export class ActivationController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly sessions: SessionService,
  ) {}

  /** Redeems a code: creates the student and the enrolment, and signs the student in. */
  @Post()
  @Header('Cache-Control', 'no-store')
  async redeem(
    @Body() body: ActivationRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StudentResponse> {
    const student = await this.onboarding.onboard(body);
    this.sessions.start(response, student.id);
    return student;
  }
}
