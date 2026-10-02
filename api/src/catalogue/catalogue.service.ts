import { Injectable } from '@nestjs/common';
import type { CourseResponse } from '@mes/contracts';
import { PrismaService } from '../prisma/prisma.service';

const lessonSummaryFields = { id: true, courseId: true, position: true, title: true, summary: true } as const;

/** A lesson as listed: everything but its body. */
export interface LessonSummary {
  id: string;
  courseId: string;
  position: number;
  title: string;
  summary: string;
}

export interface Lesson extends LessonSummary {
  body: string;
}

const courseFields = { id: true, subject: true, yearFrom: true, yearTo: true, pricePence: true } as const;

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  listCourses(): Promise<CourseResponse[]> {
    return this.prisma.course.findMany({
      select: courseFields,
      orderBy: { subject: 'asc' },
    });
  }

  /** Courses with the given ids; unknown ids are simply absent from the result. */
  findCoursesByIds(ids: string[]): Promise<CourseResponse[]> {
    return this.prisma.course.findMany({ select: courseFields, where: { id: { in: ids } } });
  }

  /** Lessons of the given courses without their bodies, in order within each course. */
  listLessonSummaries(courseIds: string[]): Promise<LessonSummary[]> {
    return this.prisma.lesson.findMany({
      select: lessonSummaryFields,
      where: { courseId: { in: courseIds } },
      orderBy: [{ courseId: 'asc' }, { position: 'asc' }],
    });
  }

  /** A lesson of this course. A lesson id that belongs to another course is not found. */
  async findLesson(courseId: string, lessonId: string): Promise<Lesson | undefined> {
    const lesson = await this.prisma.lesson.findUnique({
      select: { ...lessonSummaryFields, body: true },
      where: { id: lessonId, courseId },
    });
    return lesson ?? undefined;
  }
}
