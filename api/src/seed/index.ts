import type { PrismaClient } from '../generated/prisma/client';
import { courses } from './data';

/** Idempotent: `subject` is the natural key, so re-running updates rows instead of adding. */
export async function seedCourses(prisma: PrismaClient): Promise<void> {
  for (const { subject, ...attributes } of courses) {
    await prisma.course.upsert({
      where: { subject },
      create: { subject, ...attributes },
      update: attributes,
    });
  }
}
