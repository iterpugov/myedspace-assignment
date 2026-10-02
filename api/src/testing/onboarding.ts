import type { INestApplication } from '@nestjs/common';
import type { CheckoutResponse, StudentResponse } from '@mes/contracts';
import request from 'supertest';
import { SESSION_COOKIE } from '../identity/session.constants';
import { PrismaService } from '../prisma/prisma.service';

/** Obviously fake; never a real credential. */
export const FAKE_PASSWORD = 'not-a-real-password';

export type Subject = 'English' | 'Maths' | 'Science';

export interface OnboardingOptions {
  username?: string;
  firstName?: string;
  subject?: Subject;
  year?: number;
}

export interface OnboardedStudent {
  student: StudentResponse;
  /** The session token set at activation. */
  token: string;
  /** `mes_session=<token>`, ready for a `Cookie` request header. */
  cookie: string;
  /** The course the student was enrolled in. */
  courseId: string;
}

/** The Set-Cookie line of the session cookie, if the response sets one. */
export function sessionCookieOf(response: request.Response): string | undefined {
  const raw: unknown = response.headers['set-cookie'];
  const lines: unknown[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  return lines.find((line): line is string => typeof line === 'string' && line.startsWith(`${SESSION_COOKIE}=`));
}

/** The value of the session cookie a response sets; throws if it sets none. */
export function sessionTokenOf(response: request.Response): string {
  const line = sessionCookieOf(response);
  if (!line) throw new Error('The response set no session cookie');
  return line.split(';')[0].slice(`${SESSION_COOKIE}=`.length);
}

/**
 * A parent buys one seat and the student redeems the code, both through the real endpoints:
 * a real student with a real password hash, one enrolment and a session token.
 */
export async function onboardStudent(app: INestApplication, options: OnboardingOptions = {}): Promise<OnboardedStudent> {
  const { username = 'sam', firstName = 'Sam', subject = 'Maths', year = 7 } = options;
  const course = await app.get(PrismaService).course.findUnique({ where: { subject } });
  if (!course) throw new Error(`Seed has no ${subject} course`);

  const order = await request(app.getHttpServer())
    .post('/api/orders')
    .send({ parentName: 'Pat Parent', parentEmail: 'pat@example.com', seats: [{ courseId: course.id, year }] })
    .expect(201);
  const code = (order.body as CheckoutResponse).seats[0].activationCode;

  const response = await request(app.getHttpServer())
    .post('/api/activations')
    .send({ code, firstName, username, password: FAKE_PASSWORD })
    .expect(201);

  const token = sessionTokenOf(response);
  return { student: response.body as StudentResponse, token, cookie: `${SESSION_COOKIE}=${token}`, courseId: course.id };
}
