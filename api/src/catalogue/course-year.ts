/** Whether a course is taught in the given school year. */
export function courseCoversYear(course: { yearFrom: number; yearTo: number }, year: number): boolean {
  return Number.isInteger(year) && year >= course.yearFrom && year <= course.yearTo;
}
