import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CheckoutResponse, StudentResponse } from '@mes/contracts';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { seedCourses } from '../seed';
import { createTestApp } from '../testing/create-test-app';
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
