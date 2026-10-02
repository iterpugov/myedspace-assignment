/** The seat has already been used to enrol a different student. */
export class SeatAlreadyEnrolledError extends Error {
  constructor() {
    super('This seat is already enrolled for another student');
    this.name = 'SeatAlreadyEnrolledError';
  }
}

/** The student already has this course through another seat (ADR 005). */
export class AlreadyEnrolledInCourseError extends Error {
  constructor() {
    super('The student is already enrolled in this course');
    this.name = 'AlreadyEnrolledInCourseError';
  }
}
