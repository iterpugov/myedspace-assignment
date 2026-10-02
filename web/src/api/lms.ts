import type { EnrolledCourseResponse, LessonResponse } from '@mes/contracts';

/** An LMS request the API did not answer with 200; 401 means the session has ended. */
export class LmsError extends Error {
  constructor(readonly status: number) {
    super(`LMS request failed with status ${status}`);
  }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new LmsError(response.status);
  return (await response.json()) as T;
}

export function fetchMyCourses(): Promise<EnrolledCourseResponse[]> {
  return get('/api/lms/courses');
}

export function fetchLesson(courseId: string, lessonId: string): Promise<LessonResponse> {
  return get(`/api/lms/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`);
}
