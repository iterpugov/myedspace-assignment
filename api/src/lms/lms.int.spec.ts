import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { EnrolledCourseResponse, LessonResponse } from '@mes/contracts';
import request from 'supertest';
import { SESSION_COOKIE } from '../identity/session.constants';
import { PrismaService } from '../prisma/prisma.service';
import { seedCourses } from '../seed';
import { createTestApp } from '../testing/create-test-app';
import { onboardStudent, type OnboardedStudent, type Subject } from '../testing/onboarding';
import { resetDatabase } from '../testing/reset-database';
import { EnrolmentService } from './enrolment.service';

/** Not a real hash: students created directly never sign in with a password. */
const DUMMY_PASSWORD_HASH = 'scrypt$N=32768,r=8,p=3$dGVzdA==$dGVzdA==';
const COURSES = '/api/lms/courses';

interface StoredLesson {
  id: string;
  courseId: string;
  position: number;
  title: string;
  summary: string;
  body: string;
}

function lessonPath(courseId: string, lessonId: string): string {
  return `${COURSES}/${courseId}/lessons/${lessonId}`;
}

describe('LMS — GET /api/lms/courses and a lesson (LMS-1..LMS-4, ADR 025, ADR 028)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let enrolments: EnrolmentService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    enrolments = app.get(EnrolmentService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedCourses(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  /** Through the real purchase and activation endpoints. */
  function onboard(username: string, subject: Subject, year = 7): Promise<OnboardedStudent> {
    const firstName = `${username[0].toUpperCase()}${username.slice(1)}`;
    return onboardStudent(app, { username, firstName, subject, year });
  }

  /** A student with no enrolment (ADR 022 allows it), and a token signed by the application. */
  async function studentWithoutCourse(username = 'robin'): Promise<{ studentId: string; cookie: string }> {
    const student = await prisma.student.create({
      data: { username, firstName: 'Robin', passwordHash: DUMMY_PASSWORD_HASH },
    });
    return { studentId: student.id, cookie: `${SESSION_COOKIE}=${jwt.sign({ sub: student.id })}` };
  }

  async function courseIdOf(subject: Subject): Promise<string> {
    const course = await prisma.course.findUnique({ where: { subject } });
    if (!course) throw new Error(`Seed has no ${subject} course`);
    return course.id;
  }

  /** Lesson ids change on every reset, so lessons are addressed by subject and position. */
  async function lessonOf(subject: Subject, position = 1): Promise<StoredLesson> {
    const courseId = await courseIdOf(subject);
    const lesson = await prisma.lesson.findUnique({ where: { courseId_position: { courseId, position } } });
    if (!lesson) throw new Error(`Seed has no lesson ${position} for ${subject}`);
    return lesson;
  }

  function get(path: string, cookie?: string): request.Test {
    const call = request(app.getHttpServer()).get(path);
    return cookie === undefined ? call : call.set('Cookie', cookie);
  }

  /**
   * The one answer for "not available to you" (ADR 025): a 404 produced by the LMS itself.
   * The router's own 404 for a route that does not exist echoes the requested path, ids
   * included, so it does not count.
   */
  async function expectNotAvailable(path: string, cookie: string): Promise<request.Response> {
    const response = await get(path, cookie).expect(404);
    const [, courseId, , lessonId] = path.slice(COURSES.length).split('/');
    expect(response.text).not.toContain('Cannot GET');
    expect(response.text).not.toContain(courseId);
    expect(response.text).not.toContain(lessonId);
    return response;
  }

  describe('without a valid session (LMS-1)', () => {
    it.each([
      ['the dashboard', false],
      ['a lesson', true],
    ])('%s returns 401 without a cookie', async (_name, isLesson) => {
      await onboard('sam', 'Maths');
      const lesson = await lessonOf('Maths');
      const path = isLesson ? lessonPath(lesson.courseId, lesson.id) : COURSES;

      const response = await get(path).expect(401);

      expect(response.text).not.toContain(lesson.title);
      expect(response.text).not.toContain('Maths');
    });

    describe.each([
      ['the dashboard', false],
      ['a lesson', true],
    ])('%s', (_route, isLesson) => {
      it.each(['a garbage cookie', 'an expired token', 'a token signed with another secret'])(
        'returns 401 with %s',
        async (kind) => {
          const { student, cookie } = await onboard('sam', 'Maths');
          const lesson = await lessonOf('Maths');
          const path = isLesson ? lessonPath(lesson.courseId, lesson.id) : COURSES;
          const tokens: Record<string, string> = {
            'a garbage cookie': 'garbage',
            'an expired token': jwt.sign({ sub: student.id }, { expiresIn: -60 }),
            'a token signed with another secret': new JwtService({ secret: 'x'.repeat(40) }).sign(
              { sub: student.id },
              { algorithm: 'HS256', expiresIn: '4h' },
            ),
          };

          const response = await get(path, `${SESSION_COOKIE}=${tokens[kind]}`).expect(401);

          expect(response.text).not.toContain(lesson.title);
          // Control: the route exists and the student's real cookie opens it.
          await get(path, cookie).expect(200);
        },
      );
    });

    it('a malformed id without a cookie is 401, not 400: the guard runs before the id is looked at', async () => {
      const lesson = await lessonOf('Maths');

      await get(lessonPath('not-a-uuid', lesson.id)).expect(401);
      await get(lessonPath(lesson.courseId, 'not-a-uuid')).expect(401);
      await get(lessonPath('not-a-uuid', 'not-a-uuid')).expect(401);
    });
  });

  describe('the dashboard (LMS-2, LMS-3)', () => {
    it('lists the one course of a Maths / Year 7 student with its lessons in order, and Cache-Control: no-store', async () => {
      const { cookie, courseId } = await onboard('sam', 'Maths', 7);
      const stored = await prisma.lesson.findMany({ where: { courseId }, orderBy: { position: 'asc' } });

      const response = await get(COURSES, cookie).expect(200);
      const body = response.body as EnrolledCourseResponse[];

      expect(response.headers['cache-control']).toBe('no-store');
      expect(body).toHaveLength(1);
      expect(Object.keys(body[0]).sort()).toEqual(['courseId', 'lessons', 'subject', 'year']);
      expect(body[0]).toMatchObject({ courseId, subject: 'Maths', year: 7 });
      expect(stored.length).toBeGreaterThanOrEqual(1);
      expect(body[0].lessons).toEqual(
        stored.map(({ id, position, title, summary }) => ({ id, position, title, summary })),
      );
      expect(body[0].lessons.map((lesson) => lesson.position)).toEqual(stored.map((_lesson, index) => index + 1));
      for (const lesson of body[0].lessons) {
        expect(Object.keys(lesson).sort()).toEqual(['id', 'position', 'summary', 'title']);
      }
    });

    it('a lesson summary in the dashboard has no body', async () => {
      const { cookie, courseId } = await onboard('sam', 'Maths');
      const stored = await prisma.lesson.findMany({ where: { courseId } });

      const response = await get(COURSES, cookie).expect(200);

      expect((response.body as EnrolledCourseResponse[])[0].lessons).toHaveLength(stored.length);
      expect(response.text).not.toContain('"body"');
      for (const lesson of stored) {
        expect(response.text).not.toContain(JSON.stringify(lesson.body).slice(1, -1));
      }
    });

    it('two students with different courses each see only their own course', async () => {
      const sam = await onboard('sam', 'Maths');
      const alex = await onboard('alex', 'English');

      const samCourses = (await get(COURSES, sam.cookie).expect(200)).body as EnrolledCourseResponse[];
      const alexCourses = (await get(COURSES, alex.cookie).expect(200)).body as EnrolledCourseResponse[];

      expect(samCourses.map((course) => course.subject)).toEqual(['Maths']);
      expect(samCourses[0].courseId).toBe(sam.courseId);
      expect(alexCourses.map((course) => course.subject)).toEqual(['English']);
      expect(alexCourses[0].courseId).toBe(alex.courseId);
    });

    it('a student with two enrolments sees two entries ordered by subject, each with its own year and lessons', async () => {
      const { student, cookie, courseId: mathsId } = await onboard('sam', 'Maths', 7);
      const englishId = await courseIdOf('English');
      await enrolments.enrol({ studentId: student.id, courseId: englishId, year: 8, seatId: randomUUID() });

      const body = (await get(COURSES, cookie).expect(200)).body as EnrolledCourseResponse[];

      expect(body.map(({ courseId, subject, year }) => ({ courseId, subject, year }))).toEqual([
        { courseId: englishId, subject: 'English', year: 8 },
        { courseId: mathsId, subject: 'Maths', year: 7 },
      ]);
      const [englishLesson, mathsLesson] = await Promise.all([lessonOf('English'), lessonOf('Maths')]);
      expect(body[0].lessons[0].id).toBe(englishLesson.id);
      expect(body[1].lessons[0].id).toBe(mathsLesson.id);
    });

    it('a student with one course in two years gets two entries with the same courseId ordered by year, each with the lessons (ADR 028)', async () => {
      // The higher year first, so the order is not just the order the rows were written in.
      const { student, cookie, courseId: mathsId } = await onboard('sam', 'Maths', 10);
      const englishId = await courseIdOf('English');
      await enrolments.enrol({ studentId: student.id, courseId: englishId, year: 11, seatId: randomUUID() });
      await enrolments.enrol({ studentId: student.id, courseId: mathsId, year: 9, seatId: randomUUID() });
      const stored = await prisma.lesson.findMany({ where: { courseId: mathsId }, orderBy: { position: 'asc' } });

      const body = (await get(COURSES, cookie).expect(200)).body as EnrolledCourseResponse[];

      // By subject first, then by year: English Year 11 still comes before Maths Year 9.
      expect(body.map(({ courseId, subject, year }) => ({ courseId, subject, year }))).toEqual([
        { courseId: englishId, subject: 'English', year: 11 },
        { courseId: mathsId, subject: 'Maths', year: 9 },
        { courseId: mathsId, subject: 'Maths', year: 10 },
      ]);
      const summaries = stored.map(({ id, position, title, summary }) => ({ id, position, title, summary }));
      expect(summaries.length).toBeGreaterThanOrEqual(1);
      expect(body[1].lessons).toEqual(summaries);
      expect(body[2].lessons).toEqual(summaries);
    });

    it('a student with no enrolment gets 200 and an empty list (ADR 022)', async () => {
      const { cookie } = await studentWithoutCourse();

      const response = await get(COURSES, cookie).expect(200);

      expect(response.body).toEqual([]);
    });

    it("a studentId in the query is ignored: with the second student's cookie it returns the second student's courses", async () => {
      const sam = await onboard('sam', 'Maths');
      const alex = await onboard('alex', 'English');

      const response = await get(`${COURSES}?studentId=${sam.student.id}`, alex.cookie).expect(200);
      const body = response.body as EnrolledCourseResponse[];

      expect(body.map((course) => course.subject)).toEqual(['English']);
      expect(response.text).not.toContain(sam.courseId);
    });
  });

  describe('a lesson (LMS-4)', () => {
    it('opens for an enrolled student: 200 with id, courseId, subject, position, title, summary and body', async () => {
      const { cookie } = await onboard('sam', 'Maths');
      const lesson = await lessonOf('Maths', 2);

      const response = await get(lessonPath(lesson.courseId, lesson.id), cookie).expect(200);
      const body = response.body as LessonResponse;

      expect(body).toEqual({
        id: lesson.id,
        courseId: lesson.courseId,
        subject: 'Maths',
        position: 2,
        title: lesson.title,
        summary: lesson.summary,
        body: lesson.body,
      });
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('a student enrolled only in English asking for a Maths lesson under the Maths course gets 404, without its title or body', async () => {
      await onboard('sam', 'Maths');
      const alex = await onboard('alex', 'English');
      const lesson = await lessonOf('Maths');

      const response = await expectNotAvailable(lessonPath(lesson.courseId, lesson.id), alex.cookie);

      expect(response.text).not.toContain(lesson.title);
      expect(response.text).not.toContain(lesson.summary);
      expect(response.text).not.toContain(JSON.stringify(lesson.body).slice(1, -1));
      expect(response.text).not.toContain('Maths');
    });

    it('that 404 is identical to the 404 for a lesson id that does not exist under a course the student has', async () => {
      await onboard('sam', 'Maths');
      const alex = await onboard('alex', 'English');
      const lesson = await lessonOf('Maths');

      const notEnrolled = await expectNotAvailable(lessonPath(lesson.courseId, lesson.id), alex.cookie);
      const unknown = await expectNotAvailable(lessonPath(alex.courseId, randomUUID()), alex.cookie);

      expect(notEnrolled.body).toEqual(unknown.body);
      expect(notEnrolled.text).toBe(unknown.text);
    });

    it('a Maths lesson id under the English course id is 404 for a student enrolled in English: ids cannot be mixed', async () => {
      await onboard('sam', 'Maths');
      const alex = await onboard('alex', 'English');
      const lesson = await lessonOf('Maths');

      const response = await expectNotAvailable(lessonPath(alex.courseId, lesson.id), alex.cookie);

      expect(response.text).not.toContain(lesson.title);
      expect(response.text).not.toContain(JSON.stringify(lesson.body).slice(1, -1));
    });

    it.each<Subject>(['English', 'Maths', 'Science'])(
      'a student with no enrolment gets 404 for a real %s lesson',
      async (subject) => {
        const { cookie } = await studentWithoutCourse();
        const lesson = await lessonOf(subject);

        const response = await expectNotAvailable(lessonPath(lesson.courseId, lesson.id), cookie);

        expect(response.text).not.toContain(lesson.title);
      },
    );

    it('[S] a student who holds Maths in two years opens a Maths lesson, and a lesson of a course not held is the identical 404 as an unknown lesson (ADR 028)', async () => {
      const { student, cookie, courseId: mathsId } = await onboard('sam', 'Maths', 9);
      await enrolments.enrol({ studentId: student.id, courseId: mathsId, year: 10, seatId: randomUUID() });
      const lesson = await lessonOf('Maths', 2);
      const science = await lessonOf('Science');

      const opened = await get(lessonPath(mathsId, lesson.id), cookie).expect(200);

      expect(opened.body).toEqual({
        id: lesson.id,
        courseId: mathsId,
        subject: 'Maths',
        position: 2,
        title: lesson.title,
        summary: lesson.summary,
        body: lesson.body,
      });

      const notHeld = await expectNotAvailable(lessonPath(science.courseId, science.id), cookie);
      const unknown = await expectNotAvailable(lessonPath(mathsId, randomUUID()), cookie);

      expect(notHeld.text).not.toContain(science.title);
      expect(notHeld.body).toEqual(unknown.body);
      expect(notHeld.text).toBe(unknown.text);
    });

    it('a random course id and a random lesson id are 404', async () => {
      const { cookie, courseId } = await onboard('sam', 'Maths');
      const lesson = await lessonOf('Maths');

      await expectNotAvailable(lessonPath(randomUUID(), randomUUID()), cookie);
      await expectNotAvailable(lessonPath(randomUUID(), lesson.id), cookie);
      await expectNotAvailable(lessonPath(courseId, randomUUID()), cookie);
    });

    it.each([
      ['courseId', 'not-a-uuid', undefined],
      ['lessonId', undefined, 'not-a-uuid'],
      ['courseId (a number)', '42', undefined],
      ['lessonId (a number)', undefined, '42'],
    ])('a malformed %s with a valid session is 400', async (_name, badCourseId, badLessonId) => {
      const { cookie } = await onboard('sam', 'Maths');
      const lesson = await lessonOf('Maths');

      await get(lessonPath(badCourseId ?? lesson.courseId, badLessonId ?? lesson.id), cookie).expect(400);
    });

    it('after another student was refused, the enrolled student still opens the same lesson: the 404s were about access', async () => {
      const sam = await onboard('sam', 'Maths');
      const alex = await onboard('alex', 'English');
      const lesson = await lessonOf('Maths');
      const path = lessonPath(lesson.courseId, lesson.id);

      await get(path, alex.cookie).expect(404);
      await get(lessonPath(alex.courseId, lesson.id), alex.cookie).expect(404);

      const response = await get(path, sam.cookie).expect(200);

      expect(response.body).toMatchObject({ id: lesson.id, courseId: lesson.courseId, body: lesson.body });
    });
  });
});
