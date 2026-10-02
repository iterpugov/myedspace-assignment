import { Injectable } from '@nestjs/common';
import type { EnrolledCourseResponse, LessonResponse } from '@mes/contracts';
import { CatalogueService } from '../catalogue/catalogue.service';
import { EnrolmentService } from './enrolment.service';

/**
 * What a student sees in the LMS. Every read starts from the student's own enrolments, so
 * a course or lesson outside them cannot be reached (ADR 025).
 *
 * Enrolments belong to this module and courses and lessons to `catalogue`, so each answer
 * is put together from separate reads through CatalogueService instead of one join across
 * the module boundary. The price: more round trips, and the reads are not one snapshot —
 * a subject and its lesson list could come from different moments. The catalogue is
 * read-only seed data here, and split into services this is how it would look anyway.
 */
@Injectable()
export class LearningService {
  constructor(
    private readonly enrolments: EnrolmentService,
    private readonly catalogue: CatalogueService,
  ) {}

  /**
   * The student's courses with their lessons, one entry per enrolment, ordered by subject and
   * then year. A course held for two years appears twice (ADR 028). Empty without an enrolment.
   */
  async listCourses(studentId: string): Promise<EnrolledCourseResponse[]> {
    const enrolments = await this.enrolments.listForStudent(studentId);
    if (enrolments.length === 0) return [];

    const courseIds = [...new Set(enrolments.map((enrolment) => enrolment.courseId))];
    const [courses, lessons] = await Promise.all([
      this.catalogue.findCoursesByIds(courseIds),
      this.catalogue.listLessonSummaries(courseIds),
    ]);
    const subjects = new Map(courses.map((course) => [course.id, course.subject]));

    return enrolments
      .flatMap(({ courseId, year }) => {
        const subject = subjects.get(courseId);
        // Defensive, for a split into services: here a foreign key keeps the course in place.
        if (subject === undefined) return [];
        return {
          courseId,
          subject,
          year,
          lessons: lessons
            .filter((lesson) => lesson.courseId === courseId)
            .map(({ id, position, title, summary }) => ({ id, position, title, summary })),
        };
      })
      .sort((a, b) => a.subject.localeCompare(b.subject) || a.year - b.year);
  }

  /**
   * A lesson of a course the student is enrolled in, or undefined. The caller cannot tell
   * "not enrolled" from "no such lesson", and neither can the student.
   */
  async openLesson(studentId: string, courseId: string, lessonId: string): Promise<LessonResponse | undefined> {
    // An enrolment for any year opens the course: lessons do not differ by year (ADR 028).
    // It is checked first: no catalogue read for a course the student does not have.
    const enrolment = await this.enrolments.findForCourse(studentId, courseId);
    if (!enrolment) return undefined;

    const [lesson, [course]] = await Promise.all([
      this.catalogue.findLesson(courseId, lessonId),
      this.catalogue.findCoursesByIds([courseId]),
    ]);
    if (!lesson || !course) return undefined;

    // Named one by one, so a field added to the catalogue's lesson does not reach the student unnoticed.
    const { id, position, title, summary, body } = lesson;
    return { id, courseId, subject: course.subject, position, title, summary, body };
  }
}
