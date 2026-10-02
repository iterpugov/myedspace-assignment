import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { SESSION_KEY } from './api/session';

/**
 * For pages behind the session guard: when a request was refused with 401 the session has ended while the tab
 * was open. Asking for the session again makes RequireSession send the student to sign in.
 * Returns whether that is happening, so the page can show "Loading…" instead of an error.
 */
export function useSessionExpiry(error: unknown): boolean {
  const queryClient = useQueryClient();
  // Any of the API clients' errors: they all carry the response status.
  const expired = error instanceof Error && 'status' in error && error.status === 401;

  useEffect(() => {
    if (expired) void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
  }, [expired, queryClient]);

  return expired;
}
