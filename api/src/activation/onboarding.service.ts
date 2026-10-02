import { Injectable, Logger } from '@nestjs/common';
import type { ActivationRequest, StudentResponse } from '@mes/contracts';
import { UsernameTakenError } from '../identity/identity.errors';
import { IdentityService } from '../identity/identity.service';
import { ActivationService } from './activation.service';
import { codeInvalid, codeUsed, onboardingRefusal } from './redemption-failures';
import { RedemptionSteps } from './redemption-steps';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly codes: ActivationService,
    private readonly identity: IdentityService,
    private readonly steps: RedemptionSteps,
  ) {}

  /**
   * Turns an activation code into a student account with an enrolment.
   *
   * Three modules write here, each in its own transaction, as three services would
   * (ADR 022). The order is chosen so that no step needs compensation and no failure
   * loses a paid seat:
   *
   * - the student is created first — a taken username, the failure that is expected to
   *   happen, stops here and leaves the code untouched;
   * - the code is then claimed for that student by a conditional update — the single-use
   *   gate: of two concurrent redemptions exactly one wins;
   * - the enrolment is created and the code is marked redeemed.
   *
   * If the last part fails, the claim still says whose code it is, and the next
   * presentation of the code finishes the job — or releases the claim, if that student has
   * meanwhile got the course through another code (ADR 027; see RedemptionSteps). Nothing retries on its own.
   *
   * The cost of this order: the worst leftover is an account without a course — the
   * loser of a race, or a crash between creating the student and the claim — and nothing
   * removes it. Claiming first would avoid that, but a crash after the claim would burn a
   * code the parent paid for, and nobody can re-issue it.
   */
  async onboard(request: ActivationRequest): Promise<StudentResponse> {
    const code = await this.codes.findByCode(request.code);
    if (!code) {
      throw codeInvalid();
    }
    if (code.claimedByStudentId) {
      // Whatever happens to the unfinished redemption, the answer for whoever presents a
      // claimed code is the same: it is used.
      await this.steps.resume(code, code.claimedByStudentId);
      throw codeUsed();
    }

    const student = await this.register(request);

    if (!(await this.codes.claim(code.id, student.id))) {
      // Another request claimed the code in the meantime. The account just made stays, without a course.
      this.logger.warn(`Student ${student.id} lost the claim for a code and has no course`);
      throw codeUsed();
    }
    // A student created a moment ago has no course and no session yet, so this does not end as a duplicate.
    await this.steps.finish(code, student.id);

    // Neither the code nor the password is ever logged (ADR 020).
    this.logger.log(`Activation code redeemed for student ${student.id}`);
    return student;
  }

  private async register({ username, password, firstName }: ActivationRequest): Promise<StudentResponse> {
    try {
      return await this.identity.register({ username, password, firstName });
    } catch (error) {
      if (error instanceof UsernameTakenError) {
        throw onboardingRefusal(409, 'username_taken', 'That username is taken');
      }
      throw error;
    }
  }
}
