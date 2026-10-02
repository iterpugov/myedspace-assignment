import { Injectable, Logger } from '@nestjs/common';
import { AlreadyEnrolledInCourseError } from '../lms/enrolment.errors';
import { EnrolmentService } from '../lms/enrolment.service';
import { type ActivationCodeRecord, ActivationService } from './activation.service';

/** What completing a claim needs to know about the code; who claimed it is passed separately. */
type ClaimedCode = Pick<ActivationCodeRecord, 'id' | 'seatId' | 'courseId' | 'year' | 'redeemedAt'>;

/** How completing a claimed code ended. */
export type RedemptionOutcome = 'redeemed' | 'duplicate';

/**
 * The steps that follow a claim, shared by onboarding and by adding a course. Internal to
 * this module. Every step is safe to repeat, which is what lets an interrupted redemption
 * be picked up later (ADR 022).
 */
@Injectable()
export class RedemptionSteps {
  private readonly logger = new Logger(RedemptionSteps.name);

  constructor(
    private readonly codes: ActivationService,
    private readonly enrolments: EnrolmentService,
  ) {}

  /**
   * Completes a claimed code: enrols the student the claim names and marks the code
   * redeemed — always for the claiming student, never for whoever presents the code.
   *
   * If the student turns out to have the course already, through another seat, the claim
   * is released and the code is free for someone else (ADR 027). Releasing is safe at that
   * point: the refusal means no enrolment uses this seat.
   */
  async finish(code: ClaimedCode, studentId: string): Promise<RedemptionOutcome> {
    if (code.redeemedAt) return 'redeemed';
    try {
      await this.enrolments.enrol({ studentId, courseId: code.courseId, year: code.year, seatId: code.seatId });
    } catch (error) {
      if (!(error instanceof AlreadyEnrolledInCourseError)) throw error;
      await this.codes.release(code.id, studentId);
      this.logger.warn(`Student ${studentId} already has the course; the claim on a code was released`);
      return 'duplicate';
    }
    await this.codes.confirm(code.id);
    return 'redeemed';
  }

  /**
   * Best effort to complete a redemption that someone else left unfinished. A failure is
   * logged and not passed on: the answer to whoever presented the code does not depend on it.
   */
  async resume(code: ClaimedCode, studentId: string): Promise<void> {
    if (code.redeemedAt) return;
    try {
      if ((await this.finish(code, studentId)) === 'redeemed') {
        this.logger.log(`Interrupted redemption completed for student ${studentId}`);
      }
    } catch (error) {
      this.logger.error(
        `Completing the interrupted redemption for student ${studentId} failed`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
