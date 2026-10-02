import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { RedeemCodeResponse } from '@mes/contracts';
import { IdentityService } from '../identity/identity.service';
import { EnrolmentService } from '../lms/enrolment.service';
import { type ActivationCodeRecord, ActivationService } from './activation.service';
import { codeInvalid, codeUsed, redemptionRefusal } from './redemption-failures';
import { RedemptionSteps } from './redemption-steps';

const alreadyOwned = () =>
  redemptionRefusal(409, 'course_already_owned', 'You already have this course; the code has not been used');

@Injectable()
export class CourseAdditionService {
  private readonly logger = new Logger(CourseAdditionService.name);

  constructor(
    private readonly codes: ActivationService,
    private readonly identity: IdentityService,
    private readonly enrolments: EnrolmentService,
    private readonly steps: RedemptionSteps,
  ) {}

  /**
   * Adds the course of an activation code to an existing student (ADR 027).
   *
   * As in onboarding, each module writes in its own transaction (ADR 022), and the order is
   * chosen so that the failure that is expected to happen needs no compensation:
   *
   * - the student is asked for a duplicate first — a code for a course they already have
   *   stops here, untouched and still valid for someone else (ADR 005);
   * - the code is then claimed by a conditional update, the single-use gate;
   * - the enrolment is created and the code is marked redeemed.
   *
   * The price of checking first: the check is a read in `lms` followed by a write here, not
   * one transaction, so it can be stale — the same student redeeming two codes for one
   * course at the same moment passes it twice. The unique index in `lms` is the real rule.
   * When it refuses the enrolment after the claim, the claim is released (see
   * RedemptionSteps.finish); a crash before the release leaves a claimed code that is
   * released the next time anyone presents it. Claiming first would close the gap, but
   * then every ordinary duplicate would need that compensation.
   */
  async addCourse(studentId: string, plainCode: string): Promise<RedeemCodeResponse> {
    // The session guard reads no database (ADR 008). A token that outlived its student must
    // not claim a code: the enrolment could never be created and the paid seat would be stuck.
    if (!(await this.identity.findById(studentId))) throw new UnauthorizedException();

    const found = await this.codes.findByCode(plainCode);
    if (!found) throw codeInvalid();

    const { code, claimant } = await this.claimFor(studentId, plainCode, found);
    if (claimant !== studentId) {
      // Whatever happens to someone else's unfinished redemption, for this student the code is used.
      await this.steps.resume(code, claimant);
      throw codeUsed();
    }

    // Claimed by this student, now or earlier: finishing is safe to repeat, so a second
    // tab or a retry after a failure gets the same answer.
    if ((await this.steps.finish(code, studentId)) === 'duplicate') throw alreadyOwned();

    // The code is never logged (ADR 020).
    this.logger.log(`Course added for student ${studentId}`);
    return { courseId: code.courseId, year: code.year };
  }

  /**
   * Checks for a duplicate and claims the code, and tells who holds the claim afterwards:
   * this student, or someone who got there first.
   *
   * Other requests can change the code between the reads and the write here, so two
   * things are looked at a second time rather than taken at face value: an enrolment that
   * may be the one this very code produced a moment ago in another tab, and a lost claim
   * that the winner may already have released.
   */
  private async claimFor(
    studentId: string,
    plainCode: string,
    found: ActivationCodeRecord,
  ): Promise<{ code: ActivationCodeRecord; claimant: string }> {
    let code = found;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (code.claimedByStudentId) return { code, claimant: code.claimedByStudentId };

      if (await this.enrolments.findForCourse(studentId, code.courseId)) {
        const current = await this.codes.findByCode(plainCode);
        if (current?.claimedByStudentId === studentId) return { code: current, claimant: studentId };
        this.logger.warn(`Student ${studentId} presented a code for a course they already have`);
        throw alreadyOwned();
      }

      if (await this.codes.claim(code.id, studentId)) return { code, claimant: studentId };

      // Lost the claim. Reading again tells who won: this student in another tab, or someone else.
      const current = await this.codes.findByCode(plainCode);
      if (!current) throw codeInvalid();
      code = current;
    }

    if (code.claimedByStudentId) return { code, claimant: code.claimedByStudentId };
    // Claimed and released twice while this request watched; the student can simply try again.
    throw codeUsed();
  }
}
