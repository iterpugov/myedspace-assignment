import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { AlreadyEnrolledInCourseError, SeatAlreadyEnrolledError } from './enrolment.errors';

export interface NewEnrolment {
  studentId: string;
  courseId: string;
  year: number;
  /** The paid seat this enrolment uses up; one enrolment per seat. */
  seatId: string;
}

@Injectable()
export class EnrolmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enrols a student in a course. Safe to repeat: the same seat for the same student is
   * a no-op, which lets an interrupted redemption be finished later (ADR 022).
   */
  async enrol(enrolment: NewEnrolment): Promise<void> {
    try {
      await this.prisma.enrolment.create({ data: enrolment });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      // Two constraints can refuse the row; looking the seat up tells which one did.
      const existing = await this.prisma.enrolment.findUnique({ where: { seatId: enrolment.seatId } });
      if (!existing) throw new AlreadyEnrolledInCourseError();
      if (existing.studentId !== enrolment.studentId) throw new SeatAlreadyEnrolledError();
    }
  }
}
