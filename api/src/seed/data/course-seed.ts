/** One lesson of a course. Its position is its place in the `lessons` array, from 1. */
export interface LessonSeed {
  title: string;
  summary: string;
  /** Plain text; paragraphs are separated by a blank line. */
  body: string;
}

/** Everything the seed knows about one course. */
export interface CourseSeed {
  subject: string;
  yearFrom: number;
  yearTo: number;
  pricePence: number;
  lessons: LessonSeed[];
}
