import type { PrismaClient } from '../generated/prisma/client';
import { courses } from './data';

/**
 * Seeds courses and their lessons. Idempotent: `subject` is the natural key of a course and
 * `(courseId, position)` of a lesson, so re-running updates rows instead of adding. A lesson
 * removed from the seed data is not deleted from an existing database.
 */
export async function seedCourses(prisma: PrismaClient): Promise<void> {
  for (const { subject, lessons, ...attributes } of courses) {
    const course = await prisma.course.upsert({
      where: { subject },
      create: { subject, ...attributes },
      update: attributes,
    });

    for (const [index, lesson] of lessons.entries()) {
      const position = index + 1;
      await prisma.lesson.upsert({
        where: { courseId_position: { courseId: course.id, position } },
        create: { courseId: course.id, position, ...lesson },
        update: lesson,
      });
    }
  }
}
