import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { CheckoutResponse } from '@mes/contracts';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { ActivationService } from '../activation/activation.service';
import { PrismaService } from '../prisma/prisma.service';
import { seedCourses } from '../seed';
import { createTestApp, listenOnLoopback } from '../testing/create-test-app';
import { resetDatabase } from '../testing/reset-database';
import { PAYMENT_GATEWAY, type PaymentGateway } from './payment/payment-gateway';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){2}$/;
const CODE_ANYWHERE = /[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){2}/;
/** Well-formed, but no course has this id. */
const UNKNOWN_COURSE_ID = '00000000-0000-4000-8000-000000000000';

const parent = { parentName: 'Pat Parent', parentEmail: 'pat@example.com' };

function sha256OfNormalised(code: string): string {
  return createHash('sha256').update(code.replace(/[-\s]/g, '').toUpperCase()).digest('hex');
}

describe('Checkout — POST /api/orders (PUR-3, PUR-4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let courseIds: Record<'English' | 'Maths' | 'Science', string>;

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

  function postOrder(body: unknown, target: INestApplication = app): request.Test {
    return request(target.getHttpServer())
      .post('/api/orders')
      .send(body as object);
  }

  async function storedCounts(): Promise<{ orders: number; seats: number; codes: number }> {
    const [orders, seats, codes] = await Promise.all([
      prisma.order.count(),
      prisma.orderSeat.count(),
      prisma.activationCode.count(),
    ]);
    return { orders, seats, codes };
  }

  const NOTHING = { orders: 0, seats: 0, codes: 0 };

  describe('a valid order', () => {
    it('one seat (Maths, Year 7) returns 201 with the full response shape', async () => {
      const response = await postOrder({ ...parent, seats: [{ courseId: courseIds.Maths, year: 7 }] }).expect(201);
      const body = response.body as CheckoutResponse;

      expect(Object.keys(body).sort()).toEqual(['orderId', 'seats', 'totalPence']);
      expect(body.orderId).toMatch(UUID);
      expect(body.totalPence).toBe(19900);
      expect(body.seats).toHaveLength(1);
      expect(Object.keys(body.seats[0]).sort()).toEqual(['activationCode', 'courseId', 'pricePence', 'subject', 'year']);
      expect(body.seats[0]).toMatchObject({
        courseId: courseIds.Maths,
        subject: 'Maths',
        year: 7,
        pricePence: 19900,
      });
      expect(body.seats[0].activationCode).toMatch(CODE_PATTERN);
    });

    it('stores the order with the parent details, a payment reference and one seat', async () => {
      const response = await postOrder({ ...parent, seats: [{ courseId: courseIds.Maths, year: 7 }] }).expect(201);
      const body = response.body as CheckoutResponse;

      const orders = await prisma.order.findMany();
      expect(orders).toHaveLength(1);
      expect(orders[0]).toMatchObject({
        id: body.orderId,
        parentName: 'Pat Parent',
        parentEmail: 'pat@example.com',
        totalPence: 19900,
      });
      expect(typeof orders[0].paymentReference).toBe('string');
      expect(orders[0].paymentReference.length).toBeGreaterThan(0);
      expect(orders[0].createdAt).toBeInstanceOf(Date);

      const seats = await prisma.orderSeat.findMany();
      expect(seats).toHaveLength(1);
      expect(seats[0]).toMatchObject({
        orderId: body.orderId,
        courseId: courseIds.Maths,
        year: 7,
        pricePence: 19900,
      });
    });

    it('stores exactly one activation code: the SHA-256 of the returned code, bound to the seat with its course and year (ADR 009, ADR 019)', async () => {
      const response = await postOrder({ ...parent, seats: [{ courseId: courseIds.Maths, year: 7 }] }).expect(201);
      const { activationCode } = (response.body as CheckoutResponse).seats[0];

      const codes = await prisma.activationCode.findMany();
      const seats = await prisma.orderSeat.findMany();

      expect(codes).toHaveLength(1);
      expect(seats).toHaveLength(1);
      expect(codes[0].codeHash).toBe(sha256OfNormalised(activationCode));
      expect(codes[0].seatId).toBe(seats[0].id);
      expect(codes[0].courseId).toBe(courseIds.Maths);
      expect(codes[0].year).toBe(7);
    });

    it('keeps the plain code out of every column of Order, OrderSeat and ActivationCode', async () => {
      const response = await postOrder({ ...parent, seats: [{ courseId: courseIds.Maths, year: 7 }] }).expect(201);
      const { activationCode } = (response.body as CheckoutResponse).seats[0];
      const normalised = activationCode.replace(/-/g, '');

      const [orders, seats, codes] = await Promise.all([
        prisma.order.findMany(),
        prisma.orderSeat.findMany(),
        prisma.activationCode.findMany(),
      ]);
      expect(orders).toHaveLength(1);
      expect(seats).toHaveLength(1);
      expect(codes).toHaveLength(1);

      const everything = JSON.stringify({ orders, seats, codes }).toUpperCase();
      expect(everything).not.toContain(activationCode);
      expect(everything).not.toContain(normalised);
    });

    it('two seats return two different codes in request order and a total of 39800', async () => {
      const response = await postOrder({
        ...parent,
        seats: [
          { courseId: courseIds.Science, year: 9 },
          { courseId: courseIds.Maths, year: 7 },
        ],
      }).expect(201);
      const body = response.body as CheckoutResponse;

      expect(body.totalPence).toBe(39800);
      expect(body.seats.map(({ courseId, subject, year, pricePence }) => ({ courseId, subject, year, pricePence }))).toEqual([
        { courseId: courseIds.Science, subject: 'Science', year: 9, pricePence: 19900 },
        { courseId: courseIds.Maths, subject: 'Maths', year: 7, pricePence: 19900 },
      ]);
      const [first, second] = body.seats.map((seat) => seat.activationCode);
      expect(first).toMatch(CODE_PATTERN);
      expect(second).toMatch(CODE_PATTERN);
      expect(first).not.toBe(second);

      expect(await storedCounts()).toEqual({ orders: 1, seats: 2, codes: 2 });

      // Each returned code belongs to the seat it was returned with.
      for (const seat of body.seats) {
        const code = await prisma.activationCode.findUnique({
          where: { codeHash: sha256OfNormalised(seat.activationCode) },
        });
        expect(code).toMatchObject({ courseId: seat.courseId, year: seat.year });
        const storedSeat = await prisma.orderSeat.findUnique({ where: { id: code?.seatId ?? UNKNOWN_COURSE_ID } });
        expect(storedSeat).toMatchObject({ orderId: body.orderId, courseId: seat.courseId, year: seat.year });
      }
    });

    it('Science, Year 11 (the top of its range) returns 201', async () => {
      const response = await postOrder({ ...parent, seats: [{ courseId: courseIds.Science, year: 11 }] }).expect(201);

      expect((response.body as CheckoutResponse).seats[0]).toMatchObject({ subject: 'Science', year: 11 });
    });

    it('two identical requests create two orders with different codes', async () => {
      const body = { ...parent, seats: [{ courseId: courseIds.Maths, year: 7 }] };

      const first = (await postOrder(body).expect(201)).body as CheckoutResponse;
      const second = (await postOrder(body).expect(201)).body as CheckoutResponse;

      expect(first.orderId).not.toBe(second.orderId);
      expect(first.seats[0].activationCode).not.toBe(second.seats[0].activationCode);
      expect(await storedCounts()).toEqual({ orders: 2, seats: 2, codes: 2 });
    });
  });

  describe('a well-formed order that breaks a rule (422)', () => {
    it('Science, Year 12 is rejected and nothing is stored', async () => {
      await postOrder({ ...parent, seats: [{ courseId: courseIds.Science, year: 12 }] }).expect(422);

      expect(await storedCounts()).toEqual(NOTHING);
    });

    it('one valid and one out-of-range seat is rejected as a whole and nothing is stored', async () => {
      await postOrder({
        ...parent,
        seats: [
          { courseId: courseIds.Maths, year: 7 },
          { courseId: courseIds.Science, year: 12 },
        ],
      }).expect(422);

      expect(await storedCounts()).toEqual(NOTHING);
    });

    it('a well-formed but unknown courseId is rejected and nothing is stored', async () => {
      await postOrder({ ...parent, seats: [{ courseId: UNKNOWN_COURSE_ID, year: 7 }] }).expect(422);

      expect(await storedCounts()).toEqual(NOTHING);
    });
  });

  describe('a malformed order (400, ADR 018)', () => {
    type BodyFactory = (ids: typeof courseIds) => unknown;
    const validSeat = (ids: typeof courseIds) => ({ courseId: ids.Maths, year: 7 });

    const malformed: [string, BodyFactory][] = [
      ['a missing parentName', (ids) => ({ parentEmail: parent.parentEmail, seats: [validSeat(ids)] })],
      ['an empty parentName', (ids) => ({ ...parent, parentName: '', seats: [validSeat(ids)] })],
      ['a parentName of spaces only', (ids) => ({ ...parent, parentName: '   ', seats: [validSeat(ids)] })],
      ['a parentName with a control character', (ids) => ({ ...parent, parentName: 'Pat\u0000Parent', seats: [validSeat(ids)] })],
      ['a missing parentEmail', (ids) => ({ parentName: parent.parentName, seats: [validSeat(ids)] })],
      ['an invalid parentEmail', (ids) => ({ ...parent, parentEmail: 'not-an-email', seats: [validSeat(ids)] })],
      ['missing seats', () => ({ ...parent })],
      ['empty seats', () => ({ ...parent, seats: [] })],
      ['seats that is not an array', (ids) => ({ ...parent, seats: validSeat(ids) })],
      ['11 seats', (ids) => ({ ...parent, seats: Array.from({ length: 11 }, () => validSeat(ids)) })],
      ['a non-UUID courseId', () => ({ ...parent, seats: [{ courseId: 'maths', year: 7 }] })],
      ['a missing courseId', () => ({ ...parent, seats: [{ year: 7 }] })],
      ['year as the string "7"', (ids) => ({ ...parent, seats: [{ courseId: ids.Maths, year: '7' }] })],
      ['year 7.5', (ids) => ({ ...parent, seats: [{ courseId: ids.Maths, year: 7.5 }] })],
      ['a missing year', (ids) => ({ ...parent, seats: [{ courseId: ids.Maths }] })],
      ['a seat that is a string', () => ({ ...parent, seats: ['seat'] })],
      ['a seat that is an array', (ids) => ({ ...parent, seats: [[validSeat(ids)]] })],
      ['a seat that is null', () => ({ ...parent, seats: [null] })],
      ['a malformed seat after a valid one', (ids) => ({ ...parent, seats: [validSeat(ids), { courseId: 'maths', year: 7 }] })],
    ];

    it.each(malformed)('%s is rejected and nothing is stored', async (_name, build) => {
      await postOrder(build(courseIds)).expect(400);

      expect(await storedCounts()).toEqual(NOTHING);
    });

    it('an upper-case courseId is accepted', async () => {
      await postOrder({ ...parent, seats: [{ courseId: courseIds.Maths.toUpperCase(), year: 7 }] }).expect(201);
    });

    it('10 seats, the upper limit, are accepted', async () => {
      const seats = Array.from({ length: 10 }, () => ({ courseId: courseIds.Maths, year: 7 }));

      const response = await postOrder({ ...parent, seats }).expect(201);

      expect((response.body as CheckoutResponse).totalPence).toBe(199000);
    });

    it.each<[string, BodyFactory]>([
      ['pricePence on a seat', (ids) => ({ ...parent, seats: [{ ...validSeat(ids), pricePence: 1 }] })],
      ['totalPence on the body', (ids) => ({ ...parent, totalPence: 1, seats: [validSeat(ids)] })],
    ])('the extra property %s is rejected and nothing is stored (price is the server\'s)', async (_name, build) => {
      await postOrder(build(courseIds)).expect(400);

      expect(await storedCounts()).toEqual(NOTHING);
    });
  });

  describe('when the payment gateway fails (ADR 021)', () => {
    let failingApp: INestApplication;
    const charge = jest.fn<ReturnType<PaymentGateway['charge']>, Parameters<PaymentGateway['charge']>>();

    beforeAll(async () => {
      const gateway: PaymentGateway = { charge };
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PAYMENT_GATEWAY)
        .useValue(gateway)
        .compile();
      failingApp = moduleRef.createNestApplication();
      // The failure below is expected; keep Nest's error log out of the test output.
      failingApp.useLogger(false);
      configureApp(failingApp);
      await listenOnLoopback(failingApp);
    });

    beforeEach(() => {
      charge.mockReset();
      charge.mockRejectedValue(new Error('gateway unavailable'));
    });

    afterAll(async () => {
      await failingApp?.close();
    });

    it('answers 5xx without a code and stores no order or seat', async () => {
      const response = await postOrder({ ...parent, seats: [{ courseId: courseIds.Maths, year: 7 }] }, failingApp);

      expect(charge).toHaveBeenCalledTimes(1);
      expect(charge).toHaveBeenCalledWith(expect.objectContaining({ amountPence: 19900 }));
      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(response.status).toBeLessThan(600);
      expect(response.text).not.toMatch(CODE_ANYWHERE);
      expect(await prisma.order.count()).toBe(0);
      expect(await prisma.orderSeat.count()).toBe(0);
      // The code was issued before the charge. It stays behind as an orphan, which is
      // harmless: its plain text was never sent to anyone.
      expect(await prisma.activationCode.count()).toBe(1);
    });

    it('does not charge for an order that fails the year check', async () => {
      await postOrder({ ...parent, seats: [{ courseId: courseIds.Science, year: 12 }] }, failingApp).expect(422);

      expect(charge).not.toHaveBeenCalled();
    });
  });
  describe('when the activation module fails (ADR 021)', () => {
    let failingApp: INestApplication;
    const charge = jest.fn<ReturnType<PaymentGateway['charge']>, Parameters<PaymentGateway['charge']>>();

    beforeAll(async () => {
      const gateway: PaymentGateway = { charge };
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PAYMENT_GATEWAY)
        .useValue(gateway)
        .overrideProvider(ActivationService)
        .useValue({ issue: () => Promise.reject(new Error('activation unavailable')) })
        .compile();
      failingApp = moduleRef.createNestApplication();
      failingApp.useLogger(false);
      configureApp(failingApp);
      await listenOnLoopback(failingApp);
    });

    beforeEach(() => {
      charge.mockReset();
      charge.mockResolvedValue({ reference: 'test_reference' });
    });

    afterAll(async () => {
      await failingApp?.close();
    });

    it('answers 5xx before anything is charged or stored', async () => {
      const response = await postOrder({ ...parent, seats: [{ courseId: courseIds.Maths, year: 7 }] }, failingApp);

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(charge).not.toHaveBeenCalled();
      expect(await storedCounts()).toEqual(NOTHING);
    });
  });
});
