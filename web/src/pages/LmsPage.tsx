import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router';
import { fetchSession } from '../api/session';
import { Notice } from '../ui/Notice';
import { PageShell } from '../ui/PageShell';

/** The student's home. Only the welcome exists so far; it is reachable only when signed in. */
export function LmsPage() {
  const { data: student, isError } = useQuery({ queryKey: ['session'], queryFn: fetchSession });

  if (student === null) {
    return <Navigate to="/login" replace />;
  }

  return (
    <PageShell>
      <div className="flex max-w-form flex-col gap-6">
        {student ? (
          <>
            <h1 className="type-heading text-brand">Welcome, {student.firstName}</h1>
            <Notice>Your courses will appear here.</Notice>
          </>
        ) : isError ? (
          <Notice variant="error">We could not load your account. Please try again in a moment.</Notice>
        ) : (
          <Notice live>Loading…</Notice>
        )}
      </div>
    </PageShell>
  );
}
