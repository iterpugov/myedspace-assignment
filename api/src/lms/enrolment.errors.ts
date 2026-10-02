/** The seat has already been used to enrol a different student. */
export class SeatAlreadyEnrolledError extends Error {
  constructor() {
    super('This seat is already enrolled for another student');
    this.name = 'SeatAlreadyEnrolledError';
  }
}

/** The student already has this course for this year through another seat (ADR 028). */
export class AlreadyEnrolledInCourseError extends Error {
  constructor() {
    super('The student is already enrolled in this course for this year');
    this.name = 'AlreadyEnrolledInCourseError';
  }
}
