/** Everything the seed knows about one course. Lessons join in slice 4. */
export interface CourseSeed {
  subject: string;
  yearFrom: number;
  yearTo: number;
  pricePence: number;
}
