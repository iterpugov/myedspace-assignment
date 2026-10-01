import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PaymentGateway, PaymentResult } from './payment-gateway';

/** Approves every charge without talking to anyone (ADR 010). */
@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  charge(): Promise<PaymentResult> {
    return Promise.resolve({ reference: `mock_${randomUUID()}` });
  }
}
