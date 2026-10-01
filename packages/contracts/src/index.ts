export interface HealthResponse {
  status: 'ok';
  database: 'up';
}

export interface CourseResponse {
  id: string;
  subject: string;
  yearFrom: number;
  yearTo: number;
  /** Price in pence, e.g. 19900 for £199. */
  pricePence: number;
}

export interface CheckoutSeatRequest {
  courseId: string;
  year: number;
}

export interface CheckoutRequest {
  parentName: string;
  parentEmail: string;
  /** One seat per student. The SPA sends exactly one. */
  seats: CheckoutSeatRequest[];
}

export interface CheckoutSeatResponse {
  courseId: string;
  subject: string;
  year: number;
  pricePence: number;
  /** Plain activation code, XXXXX-XXXXX-XXXXX. Returned only here, never again. */
  activationCode: string;
}

export interface CheckoutResponse {
  orderId: string;
  totalPence: number;
  seats: CheckoutSeatResponse[];
}
