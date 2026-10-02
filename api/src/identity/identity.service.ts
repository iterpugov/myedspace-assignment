import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { StudentResponse } from '@mes/contracts';
import { isUniqueViolation } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { UsernameTakenError } from './identity.errors';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password';

export interface NewStudent {
  /** Already normalised: lower case, checked against the username rules. */
  username: string;
  password: string;
  firstName: string;
}

const studentFields = { id: true, username: true, firstName: true } as const;

@Injectable()
export class IdentityService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /** Makes the dummy hash at start, so that no login pays for it (ADR 026). */
  async onModuleInit(): Promise<void> {
    await dummyPasswordHash();
  }

  /** Creates a student with a hashed password. Throws UsernameTakenError if the username exists. */
  async register({ username, password, firstName }: NewStudent): Promise<StudentResponse> {
    const passwordHash = await hashPassword(password);
    try {
      return await this.prisma.student.create({
        data: { username, firstName, passwordHash },
        select: studentFields,
      });
    } catch (error) {
      // The unique index decides, not a read beforehand, so two racing requests cannot both win.
      // `username` is the only unique column a new student can collide on.
      if (isUniqueViolation(error)) throw new UsernameTakenError();
      throw error;
    }
  }

  /**
   * The student these credentials belong to, or undefined. An unknown username and a wrong
   * password are the same answer and cost the same one scrypt run (ADR 026).
   */
  async authenticate(username: string, password: string): Promise<StudentResponse | undefined> {
    const student = await this.prisma.student.findUnique({
      where: { username },
      select: { ...studentFields, passwordHash: true },
    });
    const matches = await verifyPassword(password, student?.passwordHash ?? (await dummyPasswordHash()));
    if (!student || !matches) return undefined;

    return { id: student.id, username: student.username, firstName: student.firstName };
  }

  async findById(id: string): Promise<StudentResponse | undefined> {
    const student = await this.prisma.student.findUnique({ where: { id }, select: studentFields });
    return student ?? undefined;
  }
}
