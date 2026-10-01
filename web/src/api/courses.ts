import type { CourseResponse } from '@mes/contracts';

export async function fetchCourses(): Promise<CourseResponse[]> {
  const response = await fetch('/api/courses');
  if (!response.ok) {
    throw new Error(`Loading courses failed with status ${response.status}`);
  }
  return (await response.json()) as CourseResponse[];
}
