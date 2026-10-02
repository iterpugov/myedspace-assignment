import type { StudentResponse } from '@mes/contracts';

/** The signed-in student, or null when nobody is signed in. */
export async function fetchSession(): Promise<StudentResponse | null> {
  const response = await fetch('/api/session');
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Loading the session failed with status ${response.status}`);
  }
  return (await response.json()) as StudentResponse;
}
