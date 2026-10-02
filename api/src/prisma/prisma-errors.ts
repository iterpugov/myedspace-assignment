import { Prisma } from '../generated/prisma/client';

/** Whether a write failed because it would break a unique constraint. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
