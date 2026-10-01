import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateActivationCode, hashActivationCode } from './activation-code';

/** What a code will grant when it is redeemed. */
export interface SeatEntitlement {
  seatId: string;
  courseId: string;
  year: number;
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
}
