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

export interface ActivationRequest {
  /** Activation code as shown to the parent; case and hyphens do not matter. */
  code: string;
  firstName: string;
  username: string;
  password: string;
}

/** The signed-in student; returned by POST /api/activations and GET /api/session. */
export interface StudentResponse {
  id: string;
  username: string;
  firstName: string;
}

export type ActivationFailureReason = 'code_invalid' | 'code_used' | 'username_taken';

/** Body of a 409 or 422 from POST /api/activations. */
export interface ActivationErrorResponse {
  statusCode: number;
  message: string;
  reason: ActivationFailureReason;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LessonSummaryResponse {
  id: string;
  /** 1-based order within the course. */
  position: number;
  title: string;
  summary: string;
}

/** A course the signed-in student is enrolled in, with its lessons in order. */
export interface EnrolledCourseResponse {
  courseId: string;
  subject: string;
  /** The year bought for this student; lessons do not differ by year (ADR 002). */
  year: number;
  lessons: LessonSummaryResponse[];
}

export interface LessonResponse extends LessonSummaryResponse {
  courseId: string;
  subject: string;
  /** Plain text; paragraphs are separated by a blank line. */
  body: string;
}

export interface RedeemCodeRequest {
  /** Activation code as shown to the parent; case and hyphens do not matter. */
  code: string;
}

/** The course added to the signed-in student's account by POST /api/redemptions. */
export interface RedeemCodeResponse {
  courseId: string;
  year: number;
}

export type RedemptionFailureReason = 'code_invalid' | 'code_used' | 'course_already_owned';

/** Body of a 409 or 422 from POST /api/redemptions. */
export interface RedemptionErrorResponse {
  statusCode: number;
  message: string;
  reason: RedemptionFailureReason;
}
