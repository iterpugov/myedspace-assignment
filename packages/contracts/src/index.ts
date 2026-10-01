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
