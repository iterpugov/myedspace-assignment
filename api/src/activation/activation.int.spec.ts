import { createHash, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ActivationErrorResponse, CheckoutResponse, StudentResponse } from '@mes/contracts';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { IdentityService } from '../identity/identity.service';
import { SESSION_COOKIE } from '../identity/session.constants';
import { EnrolmentService } from '../lms/enrolment.service';
import { PrismaService } from '../prisma/prisma.service';
import { seedCourses } from '../seed';
import { createTestApp } from '../testing/create-test-app';
import { ActivationService } from './activation.service';
import { resetDatabase } from '../testing/reset-database';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Obviously fake; never a real credential. */
const FAKE_PASSWORD = 'not-a-real-password';
/** Well-formed, but never issued. */
const UNKNOWN_CODE = 'ABCDE-FGHJK-MNPQR';
/** Not a real hash: students created directly never sign in. */
const DUMMY_PASSWORD_HASH = 'scrypt$N=32768,r=8,p=3$dGVzdA==$dGVzdA==';

type Subject = 'English' | 'Maths' | 'Science';

function sha256OfNormalised(code: string): string {
  return createHash('sha256').update(code.replace(/[-\s]/g, '').toUpperCase()).digest('hex');
}

/** The Set-Cookie line of the session cookie, if the response sets one. */
function sessionCookieOf(response: request.Response): string | undefined {
  const raw: unknown = response.headers['set-cookie'];
  const lines: unknown[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  return lines.find((line): line is string => typeof line === 'string' && line.startsWith(`${SESSION_COOKIE}=`));
}

describe('Onboarding — POST /api/activations (ONB-1..ONB-4, ADR 022, ADR 023)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let courseIds: Record<Subject, string>;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedCourses(prisma);
    const courses = await prisma.course.findMany();
    const idOf = (subject: string): string => {
      const course = courses.find((candidate) => candidate.subject === subject);
      if (!course) throw new Error(`Seed has no ${subject} course`);
      return course.id;
    };
    courseIds = { English: idOf('English'), Maths: idOf('Maths'), Science: idOf('Science') };
  });

  afterAll(async () => {
    await app?.close();
  });

  /** A parent buys one seat; the plain activation code comes back only here. */
  async function buyCode(subject: Subject = 'Maths', year = 7): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .send({ parentName: 'Pat Parent', parentEmail: 'pat@example.com', seats: [{ courseId: courseIds[subject], year }] })
      .expect(201);
    return (response.body as CheckoutResponse).seats[0].activationCode;
  }

  function activation(code: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { code, firstName: 'Sam', username: 'sam', password: FAKE_PASSWORD, ...overrides };
  }

  function postActivation(body: unknown, target: INestApplication = app): request.Test {
    return request(target.getHttpServer())
      .post('/api/activations')
      .send(body as object);
  }

  async function codeRow(code: string) {
    const row = await prisma.activationCode.findUnique({ where: { codeHash: sha256OfNormalised(code) } });
    if (!row) throw new Error('The bought code has no row');
    return row;
  }

  async function expectNothingStored(code?: string): Promise<void> {
    expect(await prisma.student.count()).toBe(0);
    expect(await prisma.enrolment.count()).toBe(0);
    if (code !== undefined) {
      expect(await codeRow(code)).toMatchObject({ claimedByStudentId: null, redeemedAt: null });
    }
  }

  describe('a valid redemption', () => {
    it('returns 201 with exactly id, username and firstName, and Cache-Control: no-store', async () => {
      const code = await buyCode();

      const response = await postActivation(activation(code)).expect(201);
      const body = response.body as StudentResponse;

      expect(Object.keys(body).sort()).toEqual(['firstName', 'id', 'username']);
      expect(body.id).toMatch(UUID);
      expect(body).toMatchObject({ username: 'sam', firstName: 'Sam' });
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('sets the mes_session cookie with HttpOnly, SameSite=Strict, Path=/api and a four-hour Max-Age (ADR 024)', async () => {
      const code = await buyCode();

      const response = await postActivation(activation(code)).expect(201);

      expect(SESSION_COOKIE).toBe('mes_session');
      const cookie = sessionCookieOf(response);
      expect(cookie).toBeDefined();
      const [pair, ...attributes] = (cookie ?? '').split(';').map((part) => part.trim());
      expect(pair.slice('mes_session='.length)).not.toBe('');
      const lowered = attributes.map((attribute) => attribute.toLowerCase());
      expect(lowered).toContain('httponly');
      expect(lowered).toContain('samesite=strict');
      expect(lowered).toContain('path=/api');
      expect(lowered).toContain('max-age=14400');
    });

    it('stores one student with a trimmed first name, a lower-case username and a scrypt hash; no table holds the password or the plain code', async () => {
      const code = await buyCode();

      const response = await postActivation(
        activation(code, { username: '  Sam_07 ', firstName: '  Sam  ' }),
      ).expect(201);
      const body = response.body as StudentResponse;

      const students = await prisma.student.findMany();
      expect(students).toHaveLength(1);
      expect(students[0]).toMatchObject({ id: body.id, username: 'sam_07', firstName: 'Sam' });
      expect(students[0].passwordHash).toMatch(/^scrypt\$N=32768,r=8,p=3\$/);
      expect(students[0].createdAt).toBeInstanceOf(Date);
      expect(body).toMatchObject({ username: 'sam_07', firstName: 'Sam' });

      const [orders, seats, codes, enrolments] = await Promise.all([
        prisma.order.findMany(),
        prisma.orderSeat.findMany(),
        prisma.activationCode.findMany(),
        prisma.enrolment.findMany(),
      ]);
      const everything = JSON.stringify({ orders, seats, codes, students, enrolments });
      expect(everything).not.toContain(FAKE_PASSWORD);
      expect(everything.toUpperCase()).not.toContain(code);
      expect(everything.toUpperCase()).not.toContain(code.replace(/-/g, ''));
      expect(response.text).not.toContain(FAKE_PASSWORD);
      expect(response.text).not.toContain('scrypt$');
    });

    it('stores one enrolment with the code\'s course, year and seat, and marks the code claimed by the student and redeemed', async () => {
      const code = await buyCode('Maths', 7);
      const before = await codeRow(code);
      expect(before).toMatchObject({ claimedByStudentId: null, redeemedAt: null });

      const response = await postActivation(activation(code)).expect(201);
      const { id } = response.body as StudentResponse;

      const enrolments = await prisma.enrolment.findMany();
      expect(enrolments).toHaveLength(1);
      expect(enrolments[0]).toMatchObject({
        studentId: id,
        courseId: courseIds.Maths,
        year: 7,
        seatId: before.seatId,
      });
      const after = await codeRow(code);
      expect(after.claimedByStudentId).toBe(id);
      expect(after.redeemedAt).toBeInstanceOf(Date);
    });

    it('accepts the code in lower case without hyphens', async () => {
      const code = await buyCode();

      const response = await postActivation(activation(code.replace(/-/g, '').toLowerCase())).expect(201);

      expect((await codeRow(code)).claimedByStudentId).toBe((response.body as StudentResponse).id);
      expect(await prisma.enrolment.count()).toBe(1);
    });

    it('two codes redeemed by two students give two students and two enrolments', async () => {
      const mathsCode = await buyCode('Maths', 7);
      const scienceCode = await buyCode('Science', 9);

      const sam = (await postActivation(activation(mathsCode, { username: 'sam' })).expect(201)).body as StudentResponse;
      const alex = (
        await postActivation(activation(scienceCode, { username: 'alex', firstName: 'Alex' })).expect(201)
      ).body as StudentResponse;

      expect(sam.id).not.toBe(alex.id);
      expect(await prisma.student.count()).toBe(2);
      const enrolments = await prisma.enrolment.findMany();
      expect(enrolments).toHaveLength(2);
      expect(enrolments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ studentId: sam.id, courseId: courseIds.Maths, year: 7 }),
          expect.objectContaining({ studentId: alex.id, courseId: courseIds.Science, year: 9 }),
        ]),
      );
    });

    it('accepts the shortest username and password (3 and 8 characters)', async () => {
      const code = await buyCode();

      await postActivation(activation(code, { username: 'sam', password: 'x'.repeat(8) })).expect(201);
    });
  });

  describe('a code that cannot be redeemed', () => {
    it('a second redemption with another username returns 409 code_used, no cookie, no new student and no new enrolment', async () => {
      const code = await buyCode();
      const first = (await postActivation(activation(code)).expect(201)).body as StudentResponse;

      const response = await postActivation(activation(code, { username: 'alex', firstName: 'Alex' })).expect(409);
      const body = response.body as ActivationErrorResponse;

      expect(body).toMatchObject({ statusCode: 409, reason: 'code_used' });
      expect(typeof body.message).toBe('string');
      expect(sessionCookieOf(response)).toBeUndefined();
      const students = await prisma.student.findMany();
      expect(students.map((student) => student.id)).toEqual([first.id]);
      const enrolments = await prisma.enrolment.findMany();
      expect(enrolments).toHaveLength(1);
      expect(enrolments[0].studentId).toBe(first.id);
      expect((await codeRow(code)).claimedByStudentId).toBe(first.id);
    });

    it('a well-formed unknown code returns 422 code_invalid and stores nothing', async () => {
      const bought = await buyCode();
      expect(bought).not.toBe(UNKNOWN_CODE);

      const response = await postActivation(activation(UNKNOWN_CODE)).expect(422);

      expect(response.body as ActivationErrorResponse).toMatchObject({ statusCode: 422, reason: 'code_invalid' });
      expect(sessionCookieOf(response)).toBeUndefined();
      await expectNothingStored(bought);
    });

    it('two concurrent redemptions with different usernames give exactly one 201 and one 409 code_used, and one enrolment for the winner', async () => {
      const code = await buyCode();

      const responses = await Promise.all([
        postActivation(activation(code, { username: 'sam' })),
        postActivation(activation(code, { username: 'alex', firstName: 'Alex' })),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
      const winner = responses.find((response) => response.status === 201);
      const loser = responses.find((response) => response.status === 409);
      const winnerId = (winner?.body as StudentResponse).id;
      expect((loser?.body as ActivationErrorResponse).reason).toBe('code_used');
      expect(loser && sessionCookieOf(loser)).toBeUndefined();

      const enrolments = await prisma.enrolment.findMany();
      expect(enrolments).toHaveLength(1);
      expect(enrolments[0].studentId).toBe(winnerId);
      const row = await codeRow(code);
      expect(row.claimedByStudentId).toBe(winnerId);
      expect(row.redeemedAt).toBeInstanceOf(Date);
      // The loser may have been rejected before or after its account was created (ADR 022).
      const students = await prisma.student.count();
      expect(students).toBeGreaterThanOrEqual(1);
      expect(students).toBeLessThanOrEqual(2);
    });
  });

  describe('a taken username', () => {
    it('returns 409 username_taken with no cookie and leaves the code unclaimed; the same code then works with a free username', async () => {
      await prisma.student.create({ data: { username: 'sam', firstName: 'Sam', passwordHash: DUMMY_PASSWORD_HASH } });
      const code = await buyCode();

      const taken = await postActivation(activation(code, { username: 'sam' })).expect(409);

      expect(taken.body as ActivationErrorResponse).toMatchObject({ statusCode: 409, reason: 'username_taken' });
      expect(sessionCookieOf(taken)).toBeUndefined();
      expect(await codeRow(code)).toMatchObject({ claimedByStudentId: null, redeemedAt: null });
      expect(await prisma.student.count()).toBe(1);
      expect(await prisma.enrolment.count()).toBe(0);

      const free = await postActivation(activation(code, { username: 'alex', firstName: 'Alex' })).expect(201);

      const { id } = free.body as StudentResponse;
      expect(sessionCookieOf(free)).toBeDefined();
      expect((await codeRow(code)).claimedByStudentId).toBe(id);
      expect(await prisma.enrolment.findMany()).toEqual([expect.objectContaining({ studentId: id })]);
    });

    it('a username differing only in case returns 409 username_taken', async () => {
      const firstCode = await buyCode('Maths', 7);
      const secondCode = await buyCode('Science', 9);
      await postActivation(activation(firstCode, { username: 'sam' })).expect(201);

      const response = await postActivation(activation(secondCode, { username: 'SAM' })).expect(409);

      expect((response.body as ActivationErrorResponse).reason).toBe('username_taken');
      expect(await prisma.student.count()).toBe(1);
      expect(await codeRow(secondCode)).toMatchObject({ claimedByStudentId: null, redeemedAt: null });
    });
  });

  describe('a malformed request (400, ADR 018)', () => {
    type BodyFactory = (code: string) => unknown;
    const without = (code: string, property: string): Record<string, unknown> => {
      const body = activation(code);
      delete body[property];
      return body;
    };

    const malformed: [string, BodyFactory][] = [
      ['a missing code', (code) => without(code, 'code')],
      ['an empty code', (code) => activation(code, { code: '' })],
      ['a code of 14 symbols', (code) => activation(code, { code: code.slice(0, -1) })],
      ['a code of 16 symbols', (code) => activation(code, { code: `${code}A` })],
      ['a code with the letter O', (code) => activation(code, { code: `${code.slice(0, -1)}O` })],
      ['a code that is a number', (code) => activation(code, { code: 123456789012345 })],
      ['a code that is an array', (code) => activation(code, { code: [code] })],
      ['a code padded beyond 64 characters', (code) => activation(code, { code: code.padEnd(65, ' ') })],
      ['a missing firstName', (code) => without(code, 'firstName')],
      ['an empty firstName', (code) => activation(code, { firstName: '' })],
      ['a firstName of spaces only', (code) => activation(code, { firstName: '   ' })],
      ['a firstName with a control character', (code) => activation(code, { firstName: 'Sa\u0000m' })],
      ['a firstName of 51 characters', (code) => activation(code, { firstName: 'a'.repeat(51) })],
      ['a firstName that is a number', (code) => activation(code, { firstName: 7 })],
      ['a missing username', (code) => without(code, 'username')],
      ['a username of 2 characters', (code) => activation(code, { username: 'sa' })],
      ['a username of 21 characters', (code) => activation(code, { username: 'a'.repeat(21) })],
      ['a username with a space inside', (code) => activation(code, { username: 'sam smith' })],
      ['a username with an @', (code) => activation(code, { username: 'sam@home' })],
      ['a username with a hyphen', (code) => activation(code, { username: 'sam-07' })],
      ['a username with a non-ASCII letter', (code) => activation(code, { username: 'sám' })],
      ['a username that is a number', (code) => activation(code, { username: 12345 })],
      ['a missing password', (code) => without(code, 'password')],
      ['a password of 7 characters', (code) => activation(code, { password: 'x'.repeat(7) })],
      ['a password of 129 characters', (code) => activation(code, { password: 'x'.repeat(129) })],
      ['a password that is a number', (code) => activation(code, { password: 1234567890 })],
      ['a password that is an array', (code) => activation(code, { password: [FAKE_PASSWORD] })],
    ];

    it.each(malformed)('%s is rejected, stores nothing and sets no cookie', async (_name, build) => {
      const code = await buyCode();

      const response = await postActivation(build(code)).expect(400);

      expect(sessionCookieOf(response)).toBeUndefined();
      await expectNothingStored(code);
    });

    it.each<[string, (ids: Record<Subject, string>) => Record<string, unknown>]>([
      ['studentId', () => ({ studentId: '00000000-0000-4000-8000-000000000000' })],
      ['courseId', (ids) => ({ courseId: ids.Science })],
      ['year', () => ({ year: 11 })],
    ])('the extra property %s is rejected and nothing is stored (the code decides the seat)', async (_name, extra) => {
      const code = await buyCode();

      const response = await postActivation(activation(code, extra(courseIds))).expect(400);

      expect(sessionCookieOf(response)).toBeUndefined();
      await expectNothingStored(code);
    });
  });

  describe('when the lms module fails after the claim (ADR 022, resume)', () => {
    let failingApp: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(EnrolmentService)
        .useValue({ enrol: () => Promise.reject(new Error('lms unavailable')) })
        .compile();
      failingApp = moduleRef.createNestApplication();
      // The failure below is expected; keep Nest's error log out of the test output.
      failingApp.useLogger(false);
      configureApp(failingApp);
      await failingApp.init();
    });

    afterAll(async () => {
      await failingApp?.close();
    });

    it('answers 5xx with no cookie and leaves the code claimed but not redeemed; the next presentation finishes the enrolment for the claiming student', async () => {
      const code = await buyCode('Maths', 7);

      const failed = await postActivation(activation(code, { username: 'sam' }), failingApp);

      expect(failed.status).toBeGreaterThanOrEqual(500);
      expect(failed.status).toBeLessThan(600);
      expect(sessionCookieOf(failed)).toBeUndefined();
      const students = await prisma.student.findMany();
      expect(students).toHaveLength(1);
      expect(students[0].username).toBe('sam');
      const claimed = await codeRow(code);
      expect(claimed.claimedByStudentId).toBe(students[0].id);
      expect(claimed.redeemedAt).toBeNull();
      expect(await prisma.enrolment.count()).toBe(0);

      // Someone else presents the code to a healthy application.
      const resumed = await postActivation(activation(code, { username: 'alex', firstName: 'Alex' })).expect(409);

      expect((resumed.body as ActivationErrorResponse).reason).toBe('code_used');
      expect(sessionCookieOf(resumed)).toBeUndefined();
      const enrolments = await prisma.enrolment.findMany();
      expect(enrolments).toHaveLength(1);
      expect(enrolments[0]).toMatchObject({
        studentId: students[0].id,
        courseId: courseIds.Maths,
        year: 7,
        seatId: claimed.seatId,
      });
      const finished = await codeRow(code);
      expect(finished.claimedByStudentId).toBe(students[0].id);
      expect(finished.redeemedAt).toBeInstanceOf(Date);
      // The presenter never gets an account, let alone the seat.
      expect((await prisma.student.findMany()).map((student) => student.username)).toEqual(['sam']);
    });

    it('tells the claiming student who tries again that the code is used, and finishes their enrolment', async () => {
      const code = await buyCode('Maths', 7);
      await postActivation(activation(code, { username: 'sam' }), failingApp);

      // Same code, same username: the claimed code is recognised before registration is tried.
      const retried = await postActivation(activation(code, { username: 'sam' })).expect(409);

      expect((retried.body as ActivationErrorResponse).reason).toBe('code_used');
      expect(await prisma.student.count()).toBe(1);
      expect(await prisma.enrolment.count()).toBe(1);
      expect((await codeRow(code)).redeemedAt).toBeInstanceOf(Date);
    });

    it('still answers "code used" when the interrupted redemption cannot be finished yet', async () => {
      const code = await buyCode('Maths', 7);
      await postActivation(activation(code, { username: 'sam' }), failingApp);

      const again = await postActivation(activation(code, { username: 'alex' }), failingApp).expect(409);

      expect((again.body as ActivationErrorResponse).reason).toBe('code_used');
      expect(await prisma.student.count()).toBe(1);
      expect((await codeRow(code)).redeemedAt).toBeNull();
    });
  });

  /** The real application with one method of the real ActivationService made to fail. */
  async function appWithFailing(method: 'claim' | 'confirm'): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ActivationService)
      .useFactory({
        factory: (prismaService: PrismaService) => {
          const service = new ActivationService(prismaService);
          jest.spyOn(service, method).mockRejectedValue(new Error('activation unavailable'));
          return service;
        },
        inject: [PrismaService],
      })
      .compile();
    const failing = moduleRef.createNestApplication();
    failing.useLogger(false);
    configureApp(failing);
    await failing.init();
    return failing;
  }

  describe('when marking the code redeemed fails after the enrolment (ADR 022)', () => {
    let failingApp: INestApplication;
    beforeAll(async () => {
      failingApp = await appWithFailing('confirm');
    });
    afterAll(async () => {
      await failingApp?.close();
    });

    it('leaves one enrolment and an unconfirmed code; the next presentation confirms it without a second enrolment', async () => {
      const code = await buyCode('Maths', 7);

      const failed = await postActivation(activation(code, { username: 'sam' }), failingApp);

      expect(failed.status).toBeGreaterThanOrEqual(500);
      expect(await prisma.enrolment.count()).toBe(1);
      expect((await codeRow(code)).redeemedAt).toBeNull();

      await postActivation(activation(code, { username: 'alex' })).expect(409);

      expect(await prisma.enrolment.count()).toBe(1);
      expect(await prisma.student.count()).toBe(1);
      expect((await codeRow(code)).redeemedAt).toBeInstanceOf(Date);
    });
  });

  describe('when the claim itself fails after the student is created (ADR 022)', () => {
    let failingApp: INestApplication;
    beforeAll(async () => {
      failingApp = await appWithFailing('claim');
    });
    afterAll(async () => {
      await failingApp?.close();
    });

    it('leaves an account without a course and the code unclaimed, so the code still works with another username', async () => {
      const code = await buyCode('Maths', 7);

      const failed = await postActivation(activation(code, { username: 'sam' }), failingApp);

      expect(failed.status).toBeGreaterThanOrEqual(500);
      expect(sessionCookieOf(failed)).toBeUndefined();
      expect(await prisma.student.count()).toBe(1);
      expect(await prisma.enrolment.count()).toBe(0);
      expect(await codeRow(code)).toMatchObject({ claimedByStudentId: null, redeemedAt: null });

      const second = await postActivation(activation(code, { username: 'sam2' })).expect(201);

      const enrolments = await prisma.enrolment.findMany();
      expect(enrolments).toHaveLength(1);
      expect(enrolments[0].studentId).toBe((second.body as StudentResponse).id);
    });
  });

  describe('the single-use gate itself (ActivationService, ADR 022)', () => {
    it('lets exactly one of several concurrent claims win, and refuses every later one', async () => {
      const code = await buyCode();
      const codes = app.get(ActivationService);
      const { id } = await codeRow(code);
      const claimants = Array.from({ length: 5 }, () => randomUUID());

      const results = await Promise.all(claimants.map((studentId) => codes.claim(id, studentId)));

      expect(results.filter(Boolean)).toHaveLength(1);
      const winner = claimants[results.indexOf(true)];
      expect((await codeRow(code)).claimedByStudentId).toBe(winner);

      expect(await codes.claim(id, randomUUID())).toBe(false);
      expect((await codeRow(code)).claimedByStudentId).toBe(winner);
    });

    it('does not mark an unclaimed code redeemed', async () => {
      const code = await buyCode();
      const codes = app.get(ActivationService);

      await codes.confirm((await codeRow(code)).id);

      expect(await codeRow(code)).toMatchObject({ claimedByStudentId: null, redeemedAt: null });
    });
  });

  describe('when the identity module fails unexpectedly', () => {
    let failingApp: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(IdentityService)
        .useValue({
          register: () => Promise.reject(new Error('identity unavailable')),
          findById: () => Promise.resolve(undefined),
        })
        .compile();
      failingApp = moduleRef.createNestApplication();
      failingApp.useLogger(false);
      configureApp(failingApp);
      await failingApp.init();
    });

    afterAll(async () => {
      await failingApp?.close();
    });

    it('answers 5xx with no cookie, leaves the code unclaimed and stores nothing', async () => {
      const code = await buyCode();

      const response = await postActivation(activation(code), failingApp);

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(response.status).toBeLessThan(600);
      expect(sessionCookieOf(response)).toBeUndefined();
      expect(response.text).not.toContain('identity unavailable');
      await expectNothingStored(code);
    });
  });
});
