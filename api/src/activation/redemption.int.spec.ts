import { createHash, randomUUID } from 'node:crypto';
import { inspect } from 'node:util';
import type { INestApplication, LoggerService } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  EnrolledCourseResponse,
  RedeemCodeResponse,
  RedemptionErrorResponse,
  RedemptionFailureReason,
  StudentResponse,
} from '@mes/contracts';
import request from 'supertest';
import { SESSION_COOKIE } from '../identity/session.constants';
import { EnrolmentService } from '../lms/enrolment.service';
import { PrismaService } from '../prisma/prisma.service';
import { seedCourses } from '../seed';
import { createTestApp } from '../testing/create-test-app';
import {
  buyCode,
  FAKE_PASSWORD,
  onboardStudent,
  sessionCookieOf,
  type OnboardedStudent,
  type Subject,
} from '../testing/onboarding';
import { resetDatabase } from '../testing/reset-database';
import { ActivationService } from './activation.service';

const REDEMPTIONS = '/api/redemptions';
/** Well-formed, but never issued. */
const UNKNOWN_CODE = 'ABCDE-FGHJK-MNPQR';
/** Not a real hash: students created directly never sign in with a password. */
const DUMMY_PASSWORD_HASH = 'scrypt$N=32768,r=8,p=3$dGVzdA==$dGVzdA==';
const DUPLICATE_MESSAGE = 'You already have this course for this year; the code has not been used';

function sha256OfNormalised(code: string): string {
  return createHash('sha256').update(code.replace(/[-\s]/g, '').toUpperCase()).digest('hex');
}

function withoutHyphens(code: string): string {
  return code.replace(/-/g, '');
}

describe('Adding a course — POST /api/redemptions (ADR 005, ADR 027, ADR 028)', () => {
  let app: INestApplication;
  /** The real application whose lms module refuses every enrolment write. */
  let lmsFailingApp: INestApplication;
  /** The real application that cannot mark a code redeemed. */
  let confirmFailingApp: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    lmsFailingApp = await createTestApp();
    jest.spyOn(lmsFailingApp.get(EnrolmentService), 'enrol').mockRejectedValue(new Error('lms unavailable'));
    confirmFailingApp = await createTestApp();
    jest
      .spyOn(confirmFailingApp.get(ActivationService), 'confirm')
      .mockRejectedValue(new Error('activation unavailable'));
    // Their failures are expected; keep Nest's error log out of the test output.
    lmsFailingApp.useLogger(false);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedCourses(prisma);
  });

  afterAll(async () => {
    await Promise.all([app?.close(), lmsFailingApp?.close(), confirmFailingApp?.close()]);
  });

  /** Through the real purchase and activation endpoints. */
  function onboard(username: string, subject: Subject, year = 7): Promise<OnboardedStudent> {
    const firstName = `${username[0].toUpperCase()}${username.slice(1)}`;
    return onboardStudent(app, { username, firstName, subject, year });
  }

  /** As `onboard`, but keeps the plain code the student used. */
  async function onboardWithCode(
    username: string,
    subject: Subject,
    year = 7,
  ): Promise<{ student: StudentResponse; code: string }> {
    const { code } = await buyCode(app, subject, year);
    const response = await request(app.getHttpServer())
      .post('/api/activations')
      .send({ code, firstName: 'Kid', username, password: FAKE_PASSWORD })
      .expect(201);
    return { student: response.body as StudentResponse, code };
  }

  /** Each application signs with its own random secret, so a cookie is made for the one it is sent to. */
  function cookieFor(target: INestApplication, studentId: string): string {
    return `${SESSION_COOKIE}=${target.get(JwtService).sign({ sub: studentId })}`;
  }

  /** A student with no enrolment (ADR 022 allows it), and a token signed by the application. */
  async function studentWithoutCourse(username = 'robin'): Promise<{ studentId: string; cookie: string }> {
    const student = await prisma.student.create({
      data: { username, firstName: 'Robin', passwordHash: DUMMY_PASSWORD_HASH },
    });
    return { studentId: student.id, cookie: cookieFor(app, student.id) };
  }

  function redeem(body: unknown, cookie?: string, target: INestApplication = app): request.Test {
    const call = request(target.getHttpServer()).post(REDEMPTIONS);
    return (cookie === undefined ? call : call.set('Cookie', cookie)).send(body as object);
  }

  async function codeRow(code: string) {
    const row = await prisma.activationCode.findUnique({ where: { codeHash: sha256OfNormalised(code) } });
    if (!row) throw new Error('The bought code has no row');
    return row;
  }

  async function expectUntouched(code: string): Promise<void> {
    expect(await codeRow(code)).toMatchObject({ claimedByStudentId: null, redeemedAt: null });
  }

  function enrolmentsOf(studentId: string, courseId?: string) {
    return prisma.enrolment.findMany({ where: { studentId, ...(courseId ? { courseId } : {}) } });
  }

  function expectFailure(response: request.Response, statusCode: 409 | 422, reason: RedemptionFailureReason): void {
    expect(response.status).toBe(statusCode);
    const body = response.body as RedemptionErrorResponse;
    expect(body).toMatchObject({ statusCode, reason });
    expect(typeof body.message).toBe('string');
  }

  /** A new student can still onboard with the code: it was never used up. */
  async function expectStillRedeemableByANewStudent(code: string, username = 'newcomer'): Promise<void> {
    const response = await request(app.getHttpServer())
      .post('/api/activations')
      .send({ code, firstName: 'New', username, password: FAKE_PASSWORD });
    expect(response.status).toBe(201);
    const { id } = response.body as StudentResponse;
    const row = await codeRow(code);
    expect(row.claimedByStudentId).toBe(id);
    expect(row.redeemedAt).toBeInstanceOf(Date);
  }

  describe('without a valid session', () => {
    it('no cookie returns 401 and leaves the code unclaimed', async () => {
      const sam = await onboard('sam', 'Maths');
      const { code } = await buyCode(app, 'English', 8);

      await redeem({ code }).expect(401);

      await expectUntouched(code);
      expect(await prisma.enrolment.count()).toBe(1);
      // Control: the route exists and the student's real cookie redeems the code.
      await redeem({ code }, sam.cookie).expect(200);
    });

    it.each(['a garbage cookie', 'an expired token', 'a token signed with another secret'])(
      '%s returns 401 and leaves the code unclaimed',
      async (kind) => {
        const sam = await onboard('sam', 'Maths');
        const { code } = await buyCode(app, 'English', 8);
        const jwt = app.get(JwtService);
        const tokens: Record<string, string> = {
          'a garbage cookie': 'garbage',
          'an expired token': jwt.sign({ sub: sam.student.id }, { expiresIn: -60 }),
          'a token signed with another secret': new JwtService({ secret: 'x'.repeat(40) }).sign(
            { sub: sam.student.id },
            { algorithm: 'HS256', expiresIn: '4h' },
          ),
        };

        await redeem({ code }, `${SESSION_COOKIE}=${tokens[kind]}`).expect(401);

        await expectUntouched(code);
        expect(await prisma.enrolment.count()).toBe(1);
        // Control: the route exists and the student's real cookie redeems the code.
        await redeem({ code }, sam.cookie).expect(200);
      },
    );

    it('a valid token for a student id that has no row returns 401 and leaves the code unclaimed', async () => {
      const { code } = await buyCode(app, 'English', 8);
      const ghost = cookieFor(app, randomUUID());

      await redeem({ code }, ghost).expect(401);

      await expectUntouched(code);
      expect(await prisma.enrolment.count()).toBe(0);
      // Control: the route exists; a student who has a row redeems the same code.
      const robin = await studentWithoutCourse();
      await redeem({ code }, robin.cookie).expect(200);
    });
  });

  describe('a valid redemption', () => {
    it('a Maths student redeems an English code: 200 with exactly courseId and year, Cache-Control: no-store, and the dashboard lists two courses', async () => {
      const sam = await onboard('sam', 'Maths', 7);
      const english = await buyCode(app, 'English', 8);
      const before = await codeRow(english.code);
      expect(before).toMatchObject({ claimedByStudentId: null, redeemedAt: null });

      const response = await redeem({ code: english.code }, sam.cookie).expect(200);
      const body = response.body as RedeemCodeResponse;

      expect(Object.keys(body).sort()).toEqual(['courseId', 'year']);
      expect(body).toEqual({ courseId: english.courseId, year: 8 });
      expect(response.headers['cache-control']).toBe('no-store');

      const added = await enrolmentsOf(sam.student.id, english.courseId);
      expect(added).toHaveLength(1);
      expect(added[0]).toMatchObject({
        studentId: sam.student.id,
        courseId: english.courseId,
        year: 8,
        seatId: before.seatId,
      });
      expect(await prisma.enrolment.count()).toBe(2);
      const after = await codeRow(english.code);
      expect(after.claimedByStudentId).toBe(sam.student.id);
      expect(after.redeemedAt).toBeInstanceOf(Date);

      const courses = await request(app.getHttpServer()).get('/api/lms/courses').set('Cookie', sam.cookie).expect(200);
      expect(
        (courses.body as EnrolledCourseResponse[]).map(({ courseId, subject, year }) => ({ courseId, subject, year })),
      ).toEqual([
        { courseId: english.courseId, subject: 'English', year: 8 },
        { courseId: sam.courseId, subject: 'Maths', year: 7 },
      ]);
    });

    it('accepts the code in lower case without hyphens', async () => {
      const sam = await onboard('sam', 'Maths');
      const english = await buyCode(app, 'English', 8);

      const response = await redeem({ code: withoutHyphens(english.code).toLowerCase() }, sam.cookie).expect(200);

      expect(response.body).toEqual({ courseId: english.courseId, year: 8 });
      expect((await codeRow(english.code)).claimedByStudentId).toBe(sam.student.id);
      expect(await enrolmentsOf(sam.student.id, english.courseId)).toHaveLength(1);
    });

    it('sets no cookie', async () => {
      const sam = await onboard('sam', 'Maths');
      const { code } = await buyCode(app, 'English', 8);

      const response = await redeem({ code }, sam.cookie).expect(200);

      expect(sessionCookieOf(response)).toBeUndefined();
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it("with the second student's cookie the enrolment belongs to the second student; the first has none for that course", async () => {
      const sam = await onboard('sam', 'Maths');
      const alex = await onboard('alex', 'Maths');
      const english = await buyCode(app, 'English', 8);

      await redeem({ code: english.code }, alex.cookie).expect(200);

      expect(await enrolmentsOf(alex.student.id, english.courseId)).toHaveLength(1);
      expect(await enrolmentsOf(sam.student.id, english.courseId)).toHaveLength(0);
      expect((await codeRow(english.code)).claimedByStudentId).toBe(alex.student.id);
    });

    it('a student with no course (ADR 022 leftover) redeems a code: 200 and one enrolment', async () => {
      const robin = await studentWithoutCourse();
      const maths = await buyCode(app, 'Maths', 7);

      const response = await redeem({ code: maths.code }, robin.cookie).expect(200);

      expect(response.body).toEqual({ courseId: maths.courseId, year: 7 });
      const enrolments = await prisma.enrolment.findMany();
      expect(enrolments).toHaveLength(1);
      expect(enrolments[0]).toMatchObject({ studentId: robin.studentId, courseId: maths.courseId, year: 7 });
      expect((await codeRow(maths.code)).redeemedAt).toBeInstanceOf(Date);
    });

    it("the caller's own redeemed code again returns 200 with the same body and no second enrolment", async () => {
      const sam = await onboard('sam', 'Maths');
      const english = await buyCode(app, 'English', 8);
      const first = await redeem({ code: english.code }, sam.cookie).expect(200);
      const redeemedAt = (await codeRow(english.code)).redeemedAt;

      const again = await redeem({ code: english.code }, sam.cookie).expect(200);

      expect(again.body).toEqual(first.body);
      expect(again.body).toEqual({ courseId: english.courseId, year: 8 });
      expect(await enrolmentsOf(sam.student.id, english.courseId)).toHaveLength(1);
      expect(await prisma.enrolment.count()).toBe(2);
      const row = await codeRow(english.code);
      expect(row.claimedByStudentId).toBe(sam.student.id);
      expect(row.redeemedAt).toEqual(redeemedAt);
    });
  });

  describe('a request that is not well formed', () => {
    it("a body with another student's studentId is 400 and nothing is stored: the session decides the student", async () => {
      const sam = await onboard('sam', 'Maths');
      const alex = await onboard('alex', 'Maths');
      const english = await buyCode(app, 'English', 8);

      await redeem({ code: english.code, studentId: alex.student.id }, sam.cookie).expect(400);

      await expectUntouched(english.code);
      expect(await prisma.enrolment.count({ where: { courseId: english.courseId } })).toBe(0);
      expect(await prisma.enrolment.count()).toBe(2);
    });

    it.each<[string, (code: string) => unknown]>([
      ['no code', () => ({})],
      ['an empty code', () => ({ code: '' })],
      ['a code that is a number', () => ({ code: 123456789012345 })],
      ['a code that is an array', (code) => ({ code: [code] })],
      ['a code padded to 65 characters', (code) => ({ code: code.padEnd(65, ' ') })],
      ['a code of 14 symbols', (code) => ({ code: code.slice(0, -1) })],
      ['a code with the letter O', (code) => ({ code: `${code.slice(0, -1)}O` })],
      ['an extra courseId', (code) => ({ code, courseId: randomUUID() })],
      ['an extra year', (code) => ({ code, year: 11 })],
    ])('%s is 400 and stores nothing', async (_name, build) => {
      const sam = await onboard('sam', 'Maths');
      const { code } = await buyCode(app, 'English', 8);

      const response = await redeem(build(code), sam.cookie).expect(400);

      // The router's own answer for a route that does not exist is not a validation error.
      expect(response.text).not.toContain('Cannot POST');
      expect(sessionCookieOf(response)).toBeUndefined();
      await expectUntouched(code);
      expect(await prisma.enrolment.count()).toBe(1);
    });

    it('a urlencoded body is 415 and stores nothing; the same code as JSON is accepted', async () => {
      const sam = await onboard('sam', 'Maths');
      const { code } = await buyCode(app, 'English', 8);

      await request(app.getHttpServer())
        .post(REDEMPTIONS)
        .set('Cookie', sam.cookie)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(`code=${code}`)
        .expect(415);

      await expectUntouched(code);
      expect(await prisma.enrolment.count()).toBe(1);
      // Control: the route exists and takes the same code as JSON.
      await redeem({ code }, sam.cookie).expect(200);
    });
  });

  describe('a code that cannot be redeemed', () => {
    it('a well-formed unknown code returns 422 code_invalid and stores nothing', async () => {
      const sam = await onboard('sam', 'Maths');
      const bought = await buyCode(app, 'English', 8);
      expect(bought.code === UNKNOWN_CODE).toBe(false);

      const response = await redeem({ code: UNKNOWN_CODE }, sam.cookie);

      expectFailure(response, 422, 'code_invalid');
      expect(sessionCookieOf(response)).toBeUndefined();
      await expectUntouched(bought.code);
      expect(await prisma.enrolment.count()).toBe(1);
    });

    it('a code redeemed by another student returns 409 code_used and changes nothing', async () => {
      const sam = await onboard('sam', 'Maths');
      const alex = await onboardWithCode('alex', 'English', 8);
      const before = await codeRow(alex.code);

      const response = await redeem({ code: alex.code }, sam.cookie);

      expectFailure(response, 409, 'code_used');
      expect(await codeRow(alex.code)).toEqual(before);
      expect(before.claimedByStudentId).toBe(alex.student.id);
      expect(await enrolmentsOf(sam.student.id)).toHaveLength(1);
      expect(await prisma.enrolment.count()).toBe(2);
    });

    it('a used code for a course the caller already has answers code_used, not "already owned", and names no student', async () => {
      const sam = await onboard('sam', 'Maths');
      const alex = await onboardWithCode('alex', 'Maths', 7);

      const response = await redeem({ code: alex.code }, sam.cookie);

      expectFailure(response, 409, 'code_used');
      expect(Object.keys(response.body as object).sort()).toEqual(['message', 'reason', 'statusCode']);
      expect(response.text).not.toContain(alex.student.id);
      expect(response.text.toLowerCase()).not.toContain('alex');
      expect(response.text).not.toContain(sam.student.id);
      expect((await codeRow(alex.code)).claimedByStudentId).toBe(alex.student.id);
      expect(await prisma.enrolment.count()).toBe(2);
    });
  });

  describe('another year of a course the student has (ADR 028)', () => {
    it('a Maths Year 9 student redeems a Maths Year 10 code: 200, two enrolments for the course, both codes redeemed, and the dashboard lists Maths twice ordered by year', async () => {
      const onboarded = await onboardWithCode('sam', 'Maths', 9);
      const sam = { ...onboarded, cookie: cookieFor(app, onboarded.student.id) };
      const second = await buyCode(app, 'Maths', 10);
      const before = await codeRow(second.code);

      const response = await redeem({ code: second.code }, sam.cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ courseId: second.courseId, year: 10 });
      expect(sessionCookieOf(response)).toBeUndefined();

      const maths = await prisma.enrolment.findMany({
        where: { studentId: sam.student.id, courseId: second.courseId },
        orderBy: { year: 'asc' },
      });
      expect(maths.map(({ year }) => year)).toEqual([9, 10]);
      expect(maths[1].seatId).toBe(before.seatId);
      expect(await prisma.enrolment.count()).toBe(2);
      for (const code of [sam.code, second.code]) {
        const row = await codeRow(code);
        expect(row.claimedByStudentId).toBe(sam.student.id);
        expect(row.redeemedAt).toBeInstanceOf(Date);
      }

      const courses = await request(app.getHttpServer()).get('/api/lms/courses').set('Cookie', sam.cookie).expect(200);
      expect(
        (courses.body as EnrolledCourseResponse[]).map(({ courseId, subject, year }) => ({ courseId, subject, year })),
      ).toEqual([
        { courseId: second.courseId, subject: 'Maths', year: 9 },
        { courseId: second.courseId, subject: 'Maths', year: 10 },
      ]);
    });

    it('a lower year added after a higher one is listed first: the dashboard is ordered by year, not by when the course was added', async () => {
      const sam = await onboard('sam', 'Maths', 10);
      const second = await buyCode(app, 'Maths', 9);

      const response = await redeem({ code: second.code }, sam.cookie);

      expect(response.status).toBe(200);
      const courses = await request(app.getHttpServer()).get('/api/lms/courses').set('Cookie', sam.cookie).expect(200);
      expect((courses.body as EnrolledCourseResponse[]).map(({ subject, year }) => ({ subject, year }))).toEqual([
        { subject: 'Maths', year: 9 },
        { subject: 'Maths', year: 10 },
      ]);
    });

    it("the caller's own redeemed code for the second year again returns 200 with the same body and no third enrolment", async () => {
      const sam = await onboard('sam', 'Maths', 9);
      const second = await buyCode(app, 'Maths', 10);
      const first = await redeem({ code: second.code }, sam.cookie);
      expect(first.status).toBe(200);

      const again = await redeem({ code: second.code }, sam.cookie);

      expect(again.status).toBe(200);
      expect(again.body).toEqual({ courseId: second.courseId, year: 10 });
      expect(await enrolmentsOf(sam.student.id, second.courseId)).toHaveLength(2);
    });
  });

  describe('a duplicate course and year (ADR 005, ADR 028: the code stays valid)', () => {
    it('a Maths Year 7 student redeeming a second Maths Year 7 code gets 409 course_already_owned; the code is untouched and a new student then onboards with it', async () => {
      const sam = await onboard('sam', 'Maths', 7);
      const second = await buyCode(app, 'Maths', 7);

      const response = await redeem({ code: second.code }, sam.cookie);

      expectFailure(response, 409, 'course_already_owned');
      expect((response.body as RedemptionErrorResponse).message).toBe(DUPLICATE_MESSAGE);
      expect(sessionCookieOf(response)).toBeUndefined();
      await expectUntouched(second.code);
      expect(await prisma.enrolment.count()).toBe(1);
      expect(await enrolmentsOf(sam.student.id)).toHaveLength(1);

      await expectStillRedeemableByANewStudent(second.code);
      expect(await enrolmentsOf(sam.student.id)).toHaveLength(1);
      expect(await prisma.enrolment.count()).toBe(2);
    });

    it('a student with Maths in Years 9 and 10 redeeming a third Maths code for Year 10 gets 409 course_already_owned; the code is untouched', async () => {
      const sam = await onboard('sam', 'Maths', 9);
      const yearTen = await buyCode(app, 'Maths', 10);
      expect((await redeem({ code: yearTen.code }, sam.cookie)).status).toBe(200);
      const third = await buyCode(app, 'Maths', 10);

      const response = await redeem({ code: third.code }, sam.cookie);

      expectFailure(response, 409, 'course_already_owned');
      // The body names no course, year or student.
      expect(Object.keys(response.body as object).sort()).toEqual(['message', 'reason', 'statusCode']);
      expect((response.body as RedemptionErrorResponse).message).toBe(DUPLICATE_MESSAGE);
      expect(response.text).not.toContain(third.courseId);
      expect(response.text).not.toContain(sam.student.id);
      await expectUntouched(third.code);
      expect(await enrolmentsOf(sam.student.id, third.courseId)).toHaveLength(2);

      await expectStillRedeemableByANewStudent(third.code);
    });
  });

  describe('concurrent redemptions', () => {
    it('one student, one code, two requests at once: both 200 and one enrolment', async () => {
      const sam = await onboard('sam', 'Maths');
      const english = await buyCode(app, 'English', 8);

      const responses = await Promise.all([
        redeem({ code: english.code }, sam.cookie),
        redeem({ code: english.code }, sam.cookie),
      ]);

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      for (const response of responses) {
        expect(response.body).toEqual({ courseId: english.courseId, year: 8 });
      }
      expect(await enrolmentsOf(sam.student.id, english.courseId)).toHaveLength(1);
      expect(await prisma.enrolment.count()).toBe(2);
      const row = await codeRow(english.code);
      expect(row.claimedByStudentId).toBe(sam.student.id);
      expect(row.redeemedAt).toBeInstanceOf(Date);
    });

    it('two students, one code: exactly one 200 and one 409 code_used, and one enrolment, for the winner', async () => {
      const sam = await onboard('sam', 'Maths');
      const alex = await onboard('alex', 'Science', 9);
      const english = await buyCode(app, 'English', 8);

      const [samResponse, alexResponse] = await Promise.all([
        redeem({ code: english.code }, sam.cookie),
        redeem({ code: english.code }, alex.cookie),
      ]);

      expect([samResponse.status, alexResponse.status].sort()).toEqual([200, 409]);
      const samWon = samResponse.status === 200;
      const winnerId = samWon ? sam.student.id : alex.student.id;
      expectFailure(samWon ? alexResponse : samResponse, 409, 'code_used');

      const enrolments = await prisma.enrolment.findMany({ where: { courseId: english.courseId } });
      expect(enrolments).toHaveLength(1);
      expect(enrolments[0].studentId).toBe(winnerId);
      const row = await codeRow(english.code);
      expect(row.claimedByStudentId).toBe(winnerId);
      expect(row.redeemedAt).toBeInstanceOf(Date);
    });

    it('one student, two codes for one course in two different years: both 200, two enrolments and both codes redeemed (ADR 028)', async () => {
      const sam = await onboard('sam', 'English', 8);
      const first = await buyCode(app, 'Maths', 7);
      const second = await buyCode(app, 'Maths', 8);

      const responses = await Promise.all([
        redeem({ code: first.code }, sam.cookie),
        redeem({ code: second.code }, sam.cookie),
      ]);

      // The two codes share no key: neither the duplicate check nor the unique index sets them against each other.
      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(responses[0].body).toEqual({ courseId: first.courseId, year: 7 });
      expect(responses[1].body).toEqual({ courseId: first.courseId, year: 8 });

      const maths = await prisma.enrolment.findMany({
        where: { studentId: sam.student.id, courseId: first.courseId },
        orderBy: { year: 'asc' },
      });
      expect(maths.map(({ year }) => year)).toEqual([7, 8]);
      expect(await prisma.enrolment.count()).toBe(3);
      for (const [index, code] of [first.code, second.code].entries()) {
        const row = await codeRow(code);
        expect(row.claimedByStudentId).toBe(sam.student.id);
        expect(row.redeemedAt).toBeInstanceOf(Date);
        expect(maths[index].seatId).toBe(row.seatId);
      }
    });

    it('one student, two codes for one course and the same year: one 200 and one 409 course_already_owned; the losing code ends unclaimed and a new student onboards with it (ADR 027, ADR 028)', async () => {
      const sam = await onboard('sam', 'English', 8);
      const sameYear = 7;
      const first = await buyCode(app, 'Maths', sameYear);
      const second = await buyCode(app, 'Maths', sameYear);

      const responses = await Promise.all([
        redeem({ code: first.code }, sam.cookie),
        redeem({ code: second.code }, sam.cookie),
      ]);

      // Either the loser's duplicate check saw the winner's enrolment, or it claimed its
      // code, was refused by the unique index and released the claim. Both end the same way.
      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      const firstWon = responses[0].status === 200;
      const [winningCode, losingCode] = firstWon ? [first.code, second.code] : [second.code, first.code];
      expectFailure(responses[firstWon ? 1 : 0], 409, 'course_already_owned');

      const maths = await enrolmentsOf(sam.student.id, first.courseId);
      expect(maths).toHaveLength(1);
      expect(maths[0].year).toBe(sameYear);
      const won = await codeRow(winningCode);
      expect(won.claimedByStudentId).toBe(sam.student.id);
      expect(won.redeemedAt).toBeInstanceOf(Date);
      expect(maths[0].seatId).toBe(won.seatId);
      await expectUntouched(losingCode);

      await expectStillRedeemableByANewStudent(losingCode);
      expect(await enrolmentsOf(sam.student.id, first.courseId)).toHaveLength(1);
    });

    it('onboarding and add-course racing for one code: exactly one succeeds, and the enrolment is the winner\'s', async () => {
      const sam = await onboard('sam', 'Maths');
      const english = await buyCode(app, 'English', 8);

      const [added, onboarded] = await Promise.all([
        redeem({ code: english.code }, sam.cookie),
        request(app.getHttpServer())
          .post('/api/activations')
          .send({ code: english.code, firstName: 'Alex', username: 'alex', password: FAKE_PASSWORD }),
      ]);

      const addWon = added.status === 200;
      expect([added.status, onboarded.status]).toEqual(addWon ? [200, 409] : [409, 201]);
      expect(((addWon ? onboarded : added).body as { reason?: string }).reason).toBe('code_used');
      const winnerId = addWon ? sam.student.id : (onboarded.body as StudentResponse).id;

      const enrolments = await prisma.enrolment.findMany({ where: { courseId: english.courseId } });
      expect(enrolments).toHaveLength(1);
      expect(enrolments[0].studentId).toBe(winnerId);
      const row = await codeRow(english.code);
      expect(row.claimedByStudentId).toBe(winnerId);
      expect(row.redeemedAt).toBeInstanceOf(Date);
    });
  });

  describe('an interrupted redemption (ADR 022, resume)', () => {
    it('lms fails after the claim: 5xx, the code is claimed by the caller and not redeemed; the caller retries and gets 200 and one enrolment', async () => {
      const sam = await onboard('sam', 'Maths');
      const english = await buyCode(app, 'English', 8);

      const failed = await redeem({ code: english.code }, cookieFor(lmsFailingApp, sam.student.id), lmsFailingApp);

      expect(failed.status).toBeGreaterThanOrEqual(500);
      expect(failed.status).toBeLessThan(600);
      expect(failed.text).not.toContain('lms unavailable');
      const claimed = await codeRow(english.code);
      expect(claimed.claimedByStudentId).toBe(sam.student.id);
      expect(claimed.redeemedAt).toBeNull();
      expect(await enrolmentsOf(sam.student.id, english.courseId)).toHaveLength(0);

      const retried = await redeem({ code: english.code }, sam.cookie).expect(200);

      expect(retried.body).toEqual({ courseId: english.courseId, year: 8 });
      const added = await enrolmentsOf(sam.student.id, english.courseId);
      expect(added).toHaveLength(1);
      expect(added[0]).toMatchObject({ year: 8, seatId: claimed.seatId });
      expect((await codeRow(english.code)).redeemedAt).toBeInstanceOf(Date);
    });

    it('a code claimed by Sam and unconfirmed, presented by Alex: 409 code_used; the enrolment is created for Sam and none for Alex', async () => {
      const sam = await onboard('sam', 'Maths');
      const alex = await onboard('alex', 'Science', 9);
      const english = await buyCode(app, 'English', 8);
      const { id, seatId } = await codeRow(english.code);
      await prisma.activationCode.update({ where: { id }, data: { claimedByStudentId: sam.student.id } });

      const response = await redeem({ code: english.code }, alex.cookie);

      expectFailure(response, 409, 'code_used');
      expect(response.text).not.toContain(sam.student.id);
      expect(await enrolmentsOf(alex.student.id, english.courseId)).toHaveLength(0);
      expect(await enrolmentsOf(alex.student.id)).toHaveLength(1);
      const resumed = await enrolmentsOf(sam.student.id, english.courseId);
      expect(resumed).toHaveLength(1);
      expect(resumed[0]).toMatchObject({ year: 8, seatId });
      const row = await codeRow(english.code);
      expect(row.claimedByStudentId).toBe(sam.student.id);
      expect(row.redeemedAt).toBeInstanceOf(Date);
    });

    it('confirmation fails after the enrolment: the retry answers 200 without a second enrolment', async () => {
      const sam = await onboard('sam', 'Maths');
      const english = await buyCode(app, 'English', 8);

      const failed = await redeem(
        { code: english.code },
        cookieFor(confirmFailingApp, sam.student.id),
        confirmFailingApp,
      );

      expect(failed.status).toBeGreaterThanOrEqual(500);
      expect(failed.status).toBeLessThan(600);
      expect(await enrolmentsOf(sam.student.id, english.courseId)).toHaveLength(1);
      const unconfirmed = await codeRow(english.code);
      expect(unconfirmed.claimedByStudentId).toBe(sam.student.id);
      expect(unconfirmed.redeemedAt).toBeNull();

      const retried = await redeem({ code: english.code }, sam.cookie).expect(200);

      expect(retried.body).toEqual({ courseId: english.courseId, year: 8 });
      expect(await enrolmentsOf(sam.student.id, english.courseId)).toHaveLength(1);
      expect(await prisma.enrolment.count()).toBe(2);
      expect((await codeRow(english.code)).redeemedAt).toBeInstanceOf(Date);
    });

    it('a code for another year of a course the student has, claimed by that student and unredeemed: presenting it answers 200 and creates the enrolment (ADR 028)', async () => {
      const sam = await onboard('sam', 'Maths', 7);
      const yearEight = await buyCode(app, 'Maths', 8);
      const { id, seatId } = await codeRow(yearEight.code);
      await prisma.activationCode.update({ where: { id }, data: { claimedByStudentId: sam.student.id } });

      const response = await redeem({ code: yearEight.code }, sam.cookie);

      // Not a duplicate any more: the claim is completed, not released.
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ courseId: yearEight.courseId, year: 8 });
      const maths = await prisma.enrolment.findMany({
        where: { studentId: sam.student.id, courseId: yearEight.courseId },
        orderBy: { year: 'asc' },
      });
      expect(maths.map(({ year }) => year)).toEqual([7, 8]);
      expect(maths[1].seatId).toBe(seatId);
      const row = await codeRow(yearEight.code);
      expect(row.claimedByStudentId).toBe(sam.student.id);
      expect(row.redeemedAt).toBeInstanceOf(Date);
    });
  });

  describe('a claim left on a code whose student already has the course for that year through another seat (ADR 027, ADR 028, release)', () => {
    /** The state a crash between the refused enrolment and the release leaves behind. */
    async function residueFor(studentId: string): Promise<string> {
      // The same course and the same year as the enrolment the student has.
      const { code } = await buyCode(app, 'Maths', 7);
      const { id } = await codeRow(code);
      await prisma.activationCode.update({ where: { id }, data: { claimedByStudentId: studentId } });
      return code;
    }

    it('presented by that student: 409 course_already_owned and the code becomes unclaimed', async () => {
      const sam = await onboard('sam', 'Maths', 7);
      const code = await residueFor(sam.student.id);

      const response = await redeem({ code }, sam.cookie);

      expectFailure(response, 409, 'course_already_owned');
      await expectUntouched(code);
      expect(await enrolmentsOf(sam.student.id)).toHaveLength(1);

      await expectStillRedeemableByANewStudent(code);
    });

    it('presented through onboarding: 409 code_used, no account is created, and the code becomes unclaimed', async () => {
      const sam = await onboard('sam', 'Maths', 7);
      const code = await residueFor(sam.student.id);

      const response = await request(app.getHttpServer())
        .post('/api/activations')
        .send({ code, firstName: 'Alex', username: 'alex', password: FAKE_PASSWORD })
        .expect(409);

      expect((response.body as { reason?: string }).reason).toBe('code_used');
      await expectUntouched(code);
      expect(await prisma.student.count()).toBe(1);
      expect(await enrolmentsOf(sam.student.id)).toHaveLength(1);

      await expectStillRedeemableByANewStudent(code);
    });

    it('presented by another student: 409 code_used, and the code becomes unclaimed as well', async () => {
      const sam = await onboard('sam', 'Maths', 7);
      const alex = await onboard('alex', 'English', 8);
      const code = await residueFor(sam.student.id);

      const response = await redeem({ code }, alex.cookie);

      expectFailure(response, 409, 'code_used');
      expect(response.text).not.toContain(sam.student.id);
      await expectUntouched(code);
      expect(await enrolmentsOf(sam.student.id)).toHaveLength(1);
      expect(await enrolmentsOf(alex.student.id)).toHaveLength(1);
      expect(await prisma.enrolment.count()).toBe(2);
    });
  });

  // Kept last: it replaces the process-wide Nest logger.
  describe('logging (ADR 020)', () => {
    const lines: string[] = [];
    const record = (...parts: unknown[]): void => {
      lines.push(parts.map((part) => (typeof part === 'string' ? part : inspect(part, { depth: 6 }))).join(' '));
    };
    const capture: LoggerService = {
      log: record,
      error: record,
      warn: record,
      debug: record,
      verbose: record,
      fatal: record,
    };

    /** In any form: with or without hyphens, in any case. */
    function mentions(text: string, code: string): boolean {
      const upper = text.toUpperCase();
      return upper.includes(code.toUpperCase()) || upper.includes(withoutHyphens(code).toUpperCase());
    }

    it('no line written during a redemption, a second year of an owned course, a duplicate, an unknown code and a failure contains the plain code', async () => {
      const sam = await onboard('sam', 'Maths', 7);
      const english = await buyCode(app, 'English', 8);
      const duplicate = await buyCode(app, 'Maths', 7);
      const otherYear = await buyCode(app, 'Maths', 8);
      const science = await buyCode(app, 'Science', 9);
      const codes = [english.code, otherYear.code, duplicate.code, science.code, UNKNOWN_CODE];

      lines.length = 0;
      // Every Logger instance of every application in this process writes through this one.
      app.useLogger(capture);
      const stdout = jest.spyOn(process.stdout, 'write');
      const stderr = jest.spyOn(process.stderr, 'write');
      let written: string[];
      try {
        await redeem({ code: withoutHyphens(english.code).toLowerCase() }, sam.cookie).expect(200);
        await redeem({ code: english.code }, sam.cookie).expect(200);
        // Status only, so that a failure here does not print a body or a code.
        expect((await redeem({ code: otherYear.code }, sam.cookie)).status).toBe(200);
        await redeem({ code: duplicate.code }, sam.cookie).expect(409);
        await redeem({ code: UNKNOWN_CODE }, sam.cookie).expect(422);
        const failed = await redeem(
          { code: science.code },
          cookieFor(lmsFailingApp, sam.student.id),
          lmsFailingApp,
        );
        expect(failed.status).toBeGreaterThanOrEqual(500);
      } finally {
        written = [...stdout.mock.calls, ...stderr.mock.calls].map(([chunk]) => String(chunk));
        stdout.mockRestore();
        stderr.mockRestore();
        app.useLogger(false);
      }

      // The capture works: the redemption is logged by student id (never by code).
      expect(lines.some((line) => line.includes(sam.student.id))).toBe(true);
      // Booleans, so that a failure here does not print a code.
      for (const code of codes) {
        expect(lines.some((line) => mentions(line, code))).toBe(false);
        expect(written.some((chunk) => mentions(chunk, code))).toBe(false);
      }
    });
  });
});
