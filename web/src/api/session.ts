import type { LoginRequest, StudentResponse } from '@mes/contracts';

/** Query key of the signed-in student; every page that asks for the session shares it. */
export const SESSION_KEY = ['session'] as const;

/** The signed-in student, or null when nobody is signed in. */
export async function fetchSession(): Promise<StudentResponse | null> {
  const response = await fetch('/api/session');
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Loading the session failed with status ${response.status}`);
  }
  return (await response.json()) as StudentResponse;
}

/** The API refused or failed the sign-in; 401 means the credentials did not match. */
export class LoginError extends Error {
  constructor(readonly status: number) {
    super(`Sign-in failed with status ${status}`);
  }
}

export async function login(request: LoginRequest): Promise<StudentResponse> {
  const response = await fetch('/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new LoginError(response.status);
  return (await response.json()) as StudentResponse;
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/session', { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Signing out failed with status ${response.status}`);
  }
}
