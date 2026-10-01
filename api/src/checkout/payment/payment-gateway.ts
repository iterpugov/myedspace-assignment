export interface PaymentRequest {
  amountPence: number;
  description: string;
}

export interface PaymentResult {
  /** The provider's id for the charge, kept on the order. */
  reference: string;
}

/** The seam a real payment provider would be plugged into. */
export interface PaymentGateway {
  /** Resolves once the money is taken; rejects if it could not be. */
  charge(request: PaymentRequest): Promise<PaymentResult>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
