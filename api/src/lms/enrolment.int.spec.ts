import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { seedCourses } from '../seed';
import { createTestApp } from '../testing/create-test-app';
import { resetDatabase } from '../testing/reset-database';
import { AlreadyEnrolledInCourseError, SeatAlreadyEnrolledError } from './enrolment.errors';
import { EnrolmentService } from './enrolment.service';

/** Not a real hash: these students never sign in. */
const DUMMY_PASSWORD_HASH = 'scrypt$N=32768,r=8,p=3$dGVzdA==$dGVzdA==';

describe('Enrolment — EnrolmentService.enrol (ONB-3, ADR 005, ADR 022)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let enrolments: EnrolmentService;
  let mathsId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    enrolments = app.get(EnrolmentService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedCourses(prisma);
    const maths = await prisma.course.findUnique({ where: { subject: 'Maths' } });
    if (!maths) throw new Error('Seed has no Maths course');
    mathsId = maths.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  async function createStudent(username: string): Promise<string> {
    const student = await prisma.student.create({
      data: { username, firstName: 'Sam', passwordHash: DUMMY_PASSWORD_HASH },
    });
    return student.id;
  }

  it('creates one enrolment with the student, course, year and seat', async () => {
    const studentId = await createStudent('sam');
    const seatId = randomUUID();

    await enrolments.enrol({ studentId, courseId: mathsId, year: 7, seatId });

    const rows = await prisma.enrolment.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ studentId, courseId: mathsId, year: 7, seatId });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  it('is idempotent per seat: the same call twice leaves one row and does not throw', async () => {
    const studentId = await createStudent('sam');
    const input = { studentId, courseId: mathsId, year: 7, seatId: randomUUID() };

    await enrolments.enrol(input);
    await expect(enrolments.enrol(input)).resolves.toBeUndefined();

    const rows = await prisma.enrolment.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject(input);
  });

  it('throws SeatAlreadyEnrolledError for the same seat and a different student, and keeps the first enrolment', async () => {
    const first = await createStudent('sam');
    const second = await createStudent('alex');
    const seatId = randomUUID();
    await enrolments.enrol({ studentId: first, courseId: mathsId, year: 7, seatId });

    await expect(enrolments.enrol({ studentId: second, courseId: mathsId, year: 7, seatId })).rejects.toBeInstanceOf(
      SeatAlreadyEnrolledError,
    );

    const rows = await prisma.enrolment.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ studentId: first, seatId });
  });

  it('throws AlreadyEnrolledInCourseError for a second seat of the same student and course (ADR 005)', async () => {
    const studentId = await createStudent('sam');
    const firstSeat = randomUUID();
    await enrolments.enrol({ studentId, courseId: mathsId, year: 7, seatId: firstSeat });

    await expect(
      enrolments.enrol({ studentId, courseId: mathsId, year: 8, seatId: randomUUID() }),
    ).rejects.toBeInstanceOf(AlreadyEnrolledInCourseError);

    const rows = await prisma.enrolment.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ studentId, seatId: firstSeat, year: 7 });
  });
});
