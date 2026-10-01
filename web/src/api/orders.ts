import type { CheckoutRequest, CheckoutResponse } from '@mes/contracts';

/** The API refused or failed the order; `status` tells a bad request from a server fault. */
export class OrderError extends Error {
  constructor(readonly status: number) {
    super(`Creating the order failed with status ${status}`);
  }
}

export async function createOrder(order: CheckoutRequest): Promise<CheckoutResponse> {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(order),
  });
  if (!response.ok) {
    throw new OrderError(response.status);
  }
  return (await response.json()) as CheckoutResponse;
}
