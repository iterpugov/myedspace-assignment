import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateActivationCode, hashActivationCode } from './activation-code';

/** What a code will grant when it is redeemed. */
export interface SeatEntitlement {
  seatId: string;
  courseId: string;
  year: number;
}

/** A stored code: what it grants and how far its redemption has got. */
export interface ActivationCodeRecord extends SeatEntitlement {
  id: string;
  /** The student the code was claimed for, once it has been claimed. */
  claimedByStudentId: string | null;
  /** Set when the enrolment exists. Claimed but not redeemed means an interrupted redemption. */
  redeemedAt: Date | null;
}

export interface IssuedCode {
  seatId: string;
  /** The plain code. It is not stored; this return value is its only copy. */
  code: string;
}

@Injectable()
export class ActivationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates one code per seat, all or none, and returns them in the order given. */
  async issue(seats: SeatEntitlement[]): Promise<IssuedCode[]> {
    const issued = seats.map((seat) => ({ seat, code: generateActivationCode() }));

    await this.prisma.activationCode.createMany({
      data: issued.map(({ seat, code }) => ({
        codeHash: hashActivationCode(code),
        seatId: seat.seatId,
        courseId: seat.courseId,
        year: seat.year,
      })),
    });

    return issued.map(({ seat, code }) => ({ seatId: seat.seatId, code }));
  }

  /** The stored code matching a plain one, if it was ever issued. */
  async findByCode(code: string): Promise<ActivationCodeRecord | undefined> {
    const record = await this.prisma.activationCode.findUnique({
      where: { codeHash: hashActivationCode(code) },
      select: { id: true, seatId: true, courseId: true, year: true, claimedByStudentId: true, redeemedAt: true },
    });
    return record ?? undefined;
  }

  /**
   * Claims a code for a student and reports whether this call won it. The condition is
   * checked by the database inside one statement, so of any number of concurrent claims
   * exactly one succeeds. This is what makes a code single use.
   */
  async claim(codeId: string, studentId: string): Promise<boolean> {
    const { count } = await this.prisma.activationCode.updateMany({
      where: { id: codeId, claimedByStudentId: null },
      data: { claimedByStudentId: studentId },
    });
    return count === 1;
  }

  /** Marks a claimed code as fully redeemed, once its enrolment exists. Safe to repeat. */
  async confirm(codeId: string): Promise<void> {
    await this.prisma.activationCode.updateMany({
      where: { id: codeId, claimedByStudentId: { not: null }, redeemedAt: null },
      data: { redeemedAt: new Date() },
    });
  }
}
