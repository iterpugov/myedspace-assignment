import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CheckoutResponse, StudentResponse } from '@mes/contracts';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { seedCourses } from '../seed';
import { createTestApp } from '../testing/create-test-app';
import { onboardStudent, sessionCookieOf, sessionTokenOf } from '../testing/onboarding';
import { resetDatabase } from '../testing/reset-database';
import { SESSION_COOKIE } from './session.constants';
import { SessionService } from './session.service';

/** Obviously fake; never a real credential. */
const FAKE_PASSWORD = 'not-a-real-password';

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('Session — GET /api/session (ONB-4, ADR 008, ADR 024)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let sessions: SessionService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    sessions = app.get(SessionService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedCourses(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  /** Buys Maths, Year 7 and redeems the code: a real student with a real session cookie. */
  async function onboard(): Promise<{ student: StudentResponse; token: string }> {
    const maths = await prisma.course.findUnique({ where: { subject: 'Maths' } });
    if (!maths) throw new Error('Seed has no Maths course');
    const order = await request(app.getHttpServer())
      .post('/api/orders')
      .send({ parentName: 'Pat Parent', parentEmail: 'pat@example.com', seats: [{ courseId: maths.id, year: 7 }] })
      .expect(201);
    const code = (order.body as CheckoutResponse).seats[0].activationCode;

    const response = await request(app.getHttpServer())
      .post('/api/activations')
      .send({ code, firstName: 'Sam', username: 'sam', password: FAKE_PASSWORD })
      .expect(201);

    const raw: unknown = response.headers['set-cookie'];
    const lines: unknown[] = Array.isArray(raw) ? raw : [raw];
    const line = lines.find(
      (candidate): candidate is string => typeof candidate === 'string' && candidate.startsWith(`${SESSION_COOKIE}=`),
    );
    if (!line) throw new Error('The activation response set no session cookie');
    const token = line.split(';')[0].slice(`${SESSION_COOKIE}=`.length);
    return { student: response.body as StudentResponse, token };
  }

  function getSession(token?: string): request.Test {
    const call = request(app.getHttpServer()).get('/api/session');
    return token === undefined ? call : call.set('Cookie', `${SESSION_COOKIE}=${token}`);
  }

  it('the cookie from a 201 authenticates: 200 with the same student and Cache-Control: no-store', async () => {
    const { student, token } = await onboard();

    const response = await getSession(token).expect(200);

    expect(response.body).toEqual(student);
    expect(Object.keys(response.body as StudentResponse).sort()).toEqual(['firstName', 'id', 'username']);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(sessions.verify(token)).toEqual({ studentId: student.id });
  });

  it('a token signed by the application for the student is accepted (control for the forged tokens below)', async () => {
    const { student } = await onboard();

    const response = await getSession(jwt.sign({ sub: student.id })).expect(200);

    expect(response.body).toEqual(student);
  });

  it('no cookie returns 401', async () => {
    await onboard();

    const response = await getSession().expect(401);

    expect(response.text).not.toContain('sam');
  });

  it.each([
    ['random text', 'garbage'],
    ['three dot-separated parts that are not a token', 'aaa.bbb.ccc'],
    ['an empty value', ''],
  ])('a garbage cookie value (%s) returns 401', async (_name, value) => {
    await onboard();

    await getSession(value).expect(401);

    expect(sessions.verify(value)).toBeUndefined();
  });

  it('a token signed with a different secret returns 401', async () => {
    const { student } = await onboard();
    const forged = new JwtService({ secret: 'x'.repeat(40) }).sign(
      { sub: student.id },
      { algorithm: 'HS256', expiresIn: '4h' },
    );

    await getSession(forged).expect(401);

    expect(sessions.verify(forged)).toBeUndefined();
  });

  it('an expired token returns 401', async () => {
    const { student } = await onboard();
    const expired = jwt.sign({ sub: student.id }, { expiresIn: -60 });

    await getSession(expired).expect(401);

    expect(sessions.verify(expired)).toBeUndefined();
  });

  it('a token with alg: none returns 401', async () => {
    const { student } = await onboard();
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ sub: student.id, iat: now, exp: now + 3600 })}.`;

    await getSession(unsigned).expect(401);

    expect(sessions.verify(unsigned)).toBeUndefined();
  });

  it('a token signed with the right secret but another algorithm (HS512) returns 401: HS256 is pinned', async () => {
    const { student } = await onboard();
    const otherAlgorithm = jwt.sign({ sub: student.id }, { algorithm: 'HS512' });

    await getSession(otherAlgorithm).expect(401);

    expect(sessions.verify(otherAlgorithm)).toBeUndefined();
  });

  it('a valid token for a student that no longer exists returns 401', async () => {
    const { student, token } = await onboard();
    await getSession(token).expect(200);
    await prisma.enrolment.deleteMany({ where: { studentId: student.id } });
    await prisma.student.delete({ where: { id: student.id } });

    await getSession(token).expect(401);
  });
});

describe('Session — POST and DELETE /api/session (LMS-1, ADR 026)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessions: SessionService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    sessions = app.get(SessionService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedCourses(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  function login(body: unknown): request.Test {
    return request(app.getHttpServer())
      .post('/api/session')
      .send(body as object);
  }

  function logout(cookie?: string): request.Test {
    const call = request(app.getHttpServer()).delete('/api/session');
    return cookie === undefined ? call : call.set('Cookie', cookie);
  }

  describe('signing in with the right credentials', () => {
    it('returns 200 with the student and Cache-Control: no-store', async () => {
      const { student } = await onboardStudent(app);

      const response = await login({ username: 'sam', password: FAKE_PASSWORD }).expect(200);

      expect(response.body).toEqual(student);
      expect(Object.keys(response.body as StudentResponse).sort()).toEqual(['firstName', 'id', 'username']);
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('sets mes_session with HttpOnly, SameSite=Strict, Path=/api, a four-hour Max-Age and no Secure by default (ADR 024)', async () => {
      await onboardStudent(app);

      const response = await login({ username: 'sam', password: FAKE_PASSWORD }).expect(200);

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
      expect(lowered).not.toContain('secure');
    });

    it('gives a cookie that authenticates GET /api/session and GET /api/lms/courses', async () => {
      const { student } = await onboardStudent(app);

      const response = await login({ username: 'sam', password: FAKE_PASSWORD }).expect(200);
      const cookie = `${SESSION_COOKIE}=${sessionTokenOf(response)}`;

      const session = await request(app.getHttpServer()).get('/api/session').set('Cookie', cookie).expect(200);
      expect(session.body).toEqual(student);
      const courses = await request(app.getHttpServer()).get('/api/lms/courses').set('Cookie', cookie).expect(200);
      expect(courses.body).toHaveLength(1);
    });

    it('accepts the username in another case and with surrounding spaces', async () => {
      const { student } = await onboardStudent(app);

      const upper = await login({ username: 'SAM', password: FAKE_PASSWORD }).expect(200);
      const spaced = await login({ username: '  Sam ', password: FAKE_PASSWORD }).expect(200);

      expect(upper.body).toEqual(student);
      expect(spaced.body).toEqual(student);
    });

    it('with two students, signing in as the second returns the second and a token for the second, never the first', async () => {
      const first = await onboardStudent(app, { username: 'sam', firstName: 'Sam', subject: 'Maths' });
      const second = await onboardStudent(app, { username: 'alex', firstName: 'Alex', subject: 'English' });

      const response = await login({ username: 'alex', password: FAKE_PASSWORD }).expect(200);

      expect(response.body).toEqual(second.student);
      expect((response.body as StudentResponse).id).not.toBe(first.student.id);
      expect(sessions.verify(sessionTokenOf(response))).toEqual({ studentId: second.student.id });
    });
  });

  describe('credentials that do not match', () => {
    it('a wrong password returns 401 "Invalid username or password" and sets no cookie', async () => {
      await onboardStudent(app);

      const response = await login({ username: 'sam', password: 'not-the-right-password' }).expect(401);

      expect(response.body).toMatchObject({ statusCode: 401, message: 'Invalid username or password' });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('an unknown username returns 401, sets no cookie, and has the same body as a wrong password', async () => {
      await onboardStudent(app);
      const wrongPassword = await login({ username: 'sam', password: 'not-the-right-password' }).expect(401);

      const unknown = await login({ username: 'nobody', password: 'not-the-right-password' }).expect(401);

      expect(unknown.headers['set-cookie']).toBeUndefined();
      expect(unknown.body).toMatchObject({ statusCode: 401, message: 'Invalid username or password' });
      expect(unknown.body).toEqual(wrongPassword.body);
      expect(unknown.text).toBe(wrongPassword.text);
    });

    it.each([
      ['a trailing space', `${FAKE_PASSWORD} `],
      ['a leading space', ` ${FAKE_PASSWORD}`],
      ['another case', FAKE_PASSWORD.toUpperCase()],
    ])('the password is not trimmed or case-folded: the right password with %s is 401', async (_name, password) => {
      await onboardStudent(app);
      // Control: the route exists and the untouched password signs in.
      await login({ username: 'sam', password: FAKE_PASSWORD }).expect(200);

      const response = await login({ username: 'sam', password }).expect(401);

      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('neither a 401 nor a 200 body contains passwordHash or the password sent', async () => {
      await onboardStudent(app);
      const stored = await prisma.student.findUniqueOrThrow({ where: { username: 'sam' } });

      const ok = await login({ username: 'sam', password: FAKE_PASSWORD }).expect(200);
      const wrong = await login({ username: 'sam', password: 'not-the-right-password' }).expect(401);
      const unknown = await login({ username: 'nobody', password: 'another-wrong-password' }).expect(401);

      for (const [response, sent] of [
        [ok, FAKE_PASSWORD],
        [wrong, 'not-the-right-password'],
        [unknown, 'another-wrong-password'],
      ] as const) {
        expect(response.text).not.toContain('passwordHash');
        expect(response.text).not.toContain(stored.passwordHash);
        expect(response.text).not.toContain(sent);
      }
    });
  });

  describe('a malformed body', () => {
    it.each<[string, Record<string, unknown>]>([
      ['a missing username', { password: FAKE_PASSWORD }],
      ['a missing password', { username: 'sam' }],
      ['an empty username', { username: '', password: FAKE_PASSWORD }],
      ['an empty password', { username: 'sam', password: '' }],
      ['an array as username', { username: ['sam'], password: FAKE_PASSWORD }],
      ['an object as username', { username: { name: 'sam' }, password: FAKE_PASSWORD }],
      ['a number as username', { username: 42, password: FAKE_PASSWORD }],
      ['a 129-character password', { username: 'sam', password: 'p'.repeat(129) }],
      ['a 65-character username', { username: 'u'.repeat(65), password: FAKE_PASSWORD }],
    ])('%s returns 400 and sets no cookie', async (_name, body) => {
      await onboardStudent(app);

      const response = await login(body).expect(400);

      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it.each([
      ['studentId', { studentId: '3f0c1a52-8f1e-4c57-9d0b-6c2f6f0f4a11' }],
      ['id', { id: '3f0c1a52-8f1e-4c57-9d0b-6c2f6f0f4a11' }],
      ['firstName', { firstName: 'Sam' }],
    ])('an extra property (%s) next to the right credentials returns 400 and sets no cookie', async (_name, extra) => {
      await onboardStudent(app);

      const response = await login({ username: 'sam', password: FAKE_PASSWORD, ...extra }).expect(400);

      expect(response.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('a body that is not JSON (ADR 026: no cross-site form can sign a browser in)', () => {
    it.each([
      ['a urlencoded form', 'application/x-www-form-urlencoded', `username=sam&password=${FAKE_PASSWORD}`],
      ['a multipart form', 'multipart/form-data; boundary=x', '--x--'],
      ['plain text', 'text/plain', JSON.stringify({ username: 'sam', password: FAKE_PASSWORD })],
    ])('%s with the right credentials returns 415 and sets no cookie', async (_name, contentType, body) => {
      await onboardStudent(app);

      const response = await request(app.getHttpServer())
        .post('/api/session')
        .set('Content-Type', contentType)
        .send(body)
        .expect(415);

      expect(sessionCookieOf(response)).toBeUndefined();
      // Control: the same credentials as JSON do sign in.
      await login({ username: 'sam', password: FAKE_PASSWORD }).expect(200);
    });
  });

  describe('signing out', () => {
    it('DELETE /api/session with a cookie returns 204, an empty body and a Set-Cookie that expires mes_session on Path=/api', async () => {
      const { cookie } = await onboardStudent(app);

      const response = await logout(cookie).expect(204);

      expect(response.text).toBe('');
      expect(response.headers['cache-control']).toBe('no-store');
      const cleared = sessionCookieOf(response);
      expect(cleared).toBeDefined();
      const [pair, ...attributes] = (cleared ?? '').split(';').map((part) => part.trim());
      expect(pair).toBe('mes_session=');
      const lowered = attributes.map((attribute) => attribute.toLowerCase());
      expect(lowered).toContain('path=/api');
      const expires = attributes.find((attribute) => attribute.toLowerCase().startsWith('expires='));
      expect(expires).toBeDefined();
      expect(new Date((expires ?? '').slice('expires='.length)).getTime()).toBeLessThan(Date.now());
    });

    it('DELETE /api/session without a cookie returns 204 as well, and still clears the cookie', async () => {
      const response = await logout().expect(204);

      expect(response.text).toBe('');
      expect(sessionCookieOf(response)).toMatch(/^mes_session=;/);
    });
  });
});
