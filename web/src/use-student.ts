import type { StudentResponse } from '@mes/contracts';
import { useOutletContext } from 'react-router';

/** The signed-in student. Only for pages rendered inside RequireSession, which provides it. */
export function useStudent(): StudentResponse {
  return useOutletContext<StudentResponse>();
}

/**
 * Query keys of LMS data. They carry the student's id, so one student's cached answer is
 * never shown to another who signs in at the same browser.
 */
export const lmsKeys = {
  all: ['lms'] as const,
  courses: (studentId: string) => ['lms', studentId, 'courses'] as const,
  lesson: (studentId: string, courseId: string, lessonId: string) =>
    ['lms', studentId, 'lesson', courseId, lessonId] as const,
};
