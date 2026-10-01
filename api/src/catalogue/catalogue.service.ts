import { Injectable } from '@nestjs/common';
import type { CourseResponse } from '@mes/contracts';
import { PrismaService } from '../prisma/prisma.service';

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
}
