import type { INestApplication } from '@nestjs/common';
import type { CourseResponse } from '@mes/contracts';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { seedCourses } from '../seed';
import { createTestApp } from '../testing/create-test-app';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('Catalogue (CAT-1, CAT-2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedCourses(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function getCourses(): Promise<CourseResponse[]> {
    const response = await request(app.getHttpServer()).get('/api/courses').expect(200);
    return response.body as CourseResponse[];
  }

  it('GET /api/courses lists the three seeded courses ordered by subject', async () => {
    const courses = await getCourses();

    expect(courses.map(({ subject, yearFrom, yearTo, pricePence }) => ({ subject, yearFrom, yearTo, pricePence }))).toEqual([
      { subject: 'English', yearFrom: 5, yearTo: 13, pricePence: 19900 },
      { subject: 'Maths', yearFrom: 5, yearTo: 13, pricePence: 19900 },
      { subject: 'Science', yearFrom: 5, yearTo: 11, pricePence: 19900 },
    ]);
  });

  it('exposes exactly the contract fields, with a UUID id', async () => {
    const courses = await getCourses();

    expect(courses).toHaveLength(3);
    for (const course of courses) {
      expect(Object.keys(course).sort()).toEqual(['id', 'pricePence', 'subject', 'yearFrom', 'yearTo']);
      expect(course.id).toMatch(UUID);
    }
  });

  it('seeding a second time keeps three rows with the same ids', async () => {
    const before = await prisma.course.findMany({ orderBy: { subject: 'asc' } });

    await seedCourses(prisma);

    const after = await prisma.course.findMany({ orderBy: { subject: 'asc' } });
    expect(after).toHaveLength(3);
    expect(after.map((course) => course.id)).toEqual(before.map((course) => course.id));
  });
});
