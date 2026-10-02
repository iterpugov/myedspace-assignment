import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { CourseResponse } from '@mes/contracts';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { seedCourses } from '../seed';
import { createTestApp } from '../testing/create-test-app';
import { CatalogueService, type LessonSummary } from './catalogue.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('Catalogue (CAT-1, CAT-2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let lessons: CatalogueService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    lessons = app.get(CatalogueService);
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

  describe('lessons (LMS-3, LMS-4, ADR 025)', () => {
    async function courseId(subject: string): Promise<string> {
      const course = await prisma.course.findUnique({ where: { subject } });
      if (!course) throw new Error(`Seed has no ${subject} course`);
      return course.id;
    }

    function storedLessons(course: string) {
      return prisma.lesson.findMany({ where: { courseId: course }, orderBy: { position: 'asc' } });
    }

    it('after seeding, every course has at least one lesson, with positions starting at 1 and contiguous', async () => {
      const courses = await prisma.course.findMany();

      expect(courses).toHaveLength(3);
      for (const course of courses) {
        const rows = await storedLessons(course.id);
        expect(rows.length).toBeGreaterThanOrEqual(1);
        expect(rows.map((row) => row.position)).toEqual(rows.map((_row, index) => index + 1));
        for (const row of rows) {
          expect(row.title).not.toBe('');
          expect(row.summary).not.toBe('');
          expect(row.body).not.toBe('');
        }
      }
    });

    it('seeding a second time keeps the same number of lessons and the same lesson ids', async () => {
      const before = await prisma.lesson.findMany({ orderBy: [{ courseId: 'asc' }, { position: 'asc' }] });

      await seedCourses(prisma);

      const after = await prisma.lesson.findMany({ orderBy: [{ courseId: 'asc' }, { position: 'asc' }] });
      expect(before.length).toBeGreaterThan(0);
      expect(after).toHaveLength(before.length);
      expect(after.map((lesson) => lesson.id)).toEqual(before.map((lesson) => lesson.id));
    });

    it('listLessonSummaries returns the lessons of the given courses in position order, without bodies; no ids gives []', async () => {
      const [maths, english] = await Promise.all([courseId('Maths'), courseId('English')]);
      const [mathsRows, englishRows] = await Promise.all([storedLessons(maths), storedLessons(english)]);
      const summaryOf = ({ id, courseId: owner, position, title, summary }: LessonSummary): LessonSummary => ({
        id,
        courseId: owner,
        position,
        title,
        summary,
      });

      const onlyMaths = await lessons.listLessonSummaries([maths]);

      expect(onlyMaths).toEqual(mathsRows.map(summaryOf));
      for (const lesson of onlyMaths) {
        expect(Object.keys(lesson).sort()).toEqual(['courseId', 'id', 'position', 'summary', 'title']);
      }

      const both = await lessons.listLessonSummaries([maths, english]);

      expect(both).toHaveLength(mathsRows.length + englishRows.length);
      expect(both.filter((lesson) => lesson.courseId === maths)).toEqual(mathsRows.map(summaryOf));
      expect(both.filter((lesson) => lesson.courseId === english)).toEqual(englishRows.map(summaryOf));
      expect(JSON.stringify(both)).not.toContain('"body"');

      await expect(lessons.listLessonSummaries([])).resolves.toEqual([]);
    });

    it('findLesson returns a lesson with its body only under its own course; another course or an unknown id gives undefined', async () => {
      const [maths, english] = await Promise.all([courseId('Maths'), courseId('English')]);
      const [mathsLesson] = await storedLessons(maths);

      const found = await lessons.findLesson(maths, mathsLesson.id);

      expect(found).toEqual({
        id: mathsLesson.id,
        courseId: maths,
        position: 1,
        title: mathsLesson.title,
        summary: mathsLesson.summary,
        body: mathsLesson.body,
      });
      await expect(lessons.findLesson(english, mathsLesson.id)).resolves.toBeUndefined();
      await expect(lessons.findLesson(maths, randomUUID())).resolves.toBeUndefined();
      await expect(lessons.findLesson(randomUUID(), mathsLesson.id)).resolves.toBeUndefined();
    });

    it('GET /api/courses (public) still returns exactly the five course fields: no lessons leak into the catalogue', async () => {
      const [mathsLesson] = await storedLessons(await courseId('Maths'));

      const response = await request(app.getHttpServer()).get('/api/courses').expect(200);

      for (const course of response.body as CourseResponse[]) {
        expect(Object.keys(course).sort()).toEqual(['id', 'pricePence', 'subject', 'yearFrom', 'yearTo']);
      }
      expect(response.text).not.toContain('lessons');
      expect(response.text).not.toContain(mathsLesson.id);
      expect(response.text).not.toContain(mathsLesson.title);
    });
  });
});
