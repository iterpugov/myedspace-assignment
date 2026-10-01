import { Injectable } from '@nestjs/common';
import type { CourseResponse } from '@mes/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  listCourses(): Promise<CourseResponse[]> {
    return this.prisma.course.findMany({
      select: { id: true, subject: true, yearFrom: true, yearTo: true, pricePence: true },
      orderBy: { subject: 'asc' },
    });
  }
}
