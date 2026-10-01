import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import type { CheckoutRequest, CheckoutResponse, CourseResponse } from '@mes/contracts';
import { ActivationService } from '../activation/activation.service';
import { CatalogueService } from '../catalogue/catalogue.service';
import { courseCoversYear } from '../catalogue/course-year';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_GATEWAY, type PaymentGateway } from './payment/payment-gateway';

interface PricedSeat {
  id: string;
  course: CourseResponse;
  year: number;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogue: CatalogueService,
    private readonly activation: ActivationService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /**
   * Creates a paid order and returns one activation code per seat.
   *
   * The order and its codes belong to different modules and are written in separate
   * transactions, as they would be between two services (ADR 021). The steps are ordered
   * so that no failure leaves a paid order without a code, and no code leaves the server
   * before its order exists:
   *
   * 1. codes are issued first — if a later step fails, they are orphans whose plain text
   *    nobody has seen, so they cannot be used;
   * 2. the charge comes next — nothing is charged unless the codes exist;
   * 3. the order is saved last, and only then do the codes leave the server.
   *
   * The reverse order (order, then codes) could leave a paid order with no code, and a
   * retry could not return the same code because only its hash is stored. The price of
   * this order of steps: orphan codes can exist, and a code's seat is not a foreign key.
   * One case stays open: a charge whose order then fails to save. No ordering of steps
   * removes it; a real provider's webhook would reconcile it.
   */
  async checkout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const seats = await this.priceSeats(request);
    const totalPence = seats.reduce((sum, seat) => sum + seat.course.pricePence, 0);

    const codes = await this.activation.issue(
      seats.map((seat) => ({ seatId: seat.id, courseId: seat.course.id, year: seat.year })),
    );

    const payment = await this.gateway.charge({
      amountPence: totalPence,
      description: `MyEdSpace order, ${seats.length} seat(s)`,
    });

    const order = await this.prisma.order.create({
      data: {
        parentName: request.parentName,
        parentEmail: request.parentEmail,
        totalPence,
        paymentReference: payment.reference,
        seats: {
          create: seats.map((seat) => ({
            id: seat.id,
            courseId: seat.course.id,
            year: seat.year,
            pricePence: seat.course.pricePence,
          })),
        },
      },
      select: { id: true },
    });

    // The codes themselves are never logged (ADR 020).
    this.logger.log(`Order ${order.id} paid, ${codes.length} activation code(s) issued`);

    const codeBySeat = new Map(codes.map(({ seatId, code }) => [seatId, code]));
    const codeFor = (seatId: string): string => {
      const code = codeBySeat.get(seatId);
      if (!code) throw new Error(`No activation code was issued for seat ${seatId}`);
      return code;
    };
    return {
      orderId: order.id,
      totalPence,
      seats: seats.map((seat) => ({
        courseId: seat.course.id,
        subject: seat.course.subject,
        year: seat.year,
        pricePence: seat.course.pricePence,
        activationCode: codeFor(seat.id),
      })),
    };
  }

  /** Resolves each requested seat to its course and price, rejecting the whole order on any bad seat. */
  private async priceSeats(request: CheckoutRequest): Promise<PricedSeat[]> {
    const ids = [...new Set(request.seats.map((seat) => seat.courseId))];
    const courses = new Map((await this.catalogue.findCoursesByIds(ids)).map((course) => [course.id, course]));

    return request.seats.map(({ courseId, year }) => {
      const course = courses.get(courseId);
      if (!course) {
        throw new UnprocessableEntityException(`Course ${courseId} does not exist`);
      }
      if (!courseCoversYear(course, year)) {
        throw new UnprocessableEntityException(
          `${course.subject} is available for Years ${course.yearFrom}–${course.yearTo}, not Year ${year}`,
        );
      }
      return { id: randomUUID(), course, year };
    });
  }
}
