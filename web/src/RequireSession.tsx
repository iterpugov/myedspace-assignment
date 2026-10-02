import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useNavigate } from 'react-router';
import { fetchSession, logout, SESSION_KEY } from './api/session';
import { HeaderButton, HeaderLink } from './ui/Header';
import { Notice } from './ui/Notice';
import { PageShell } from './ui/PageShell';

/**
 * Layout for every LMS route: nothing inside renders without a signed-in student. The
 * pages inside get the student from `useOutletContext<StudentResponse>()`.
 */
export function RequireSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: student, isError } = useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession });

  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      navigate('/login', { replace: true });
      // Nothing of this student stays in memory for the next person at this browser.
      queryClient.clear();
    },
  });

  if (student === null) {
    return <Navigate to="/login" replace />;
  }

  if (!student) {
    // An empty navigation: not the public links, and not the LMS ones before we know who this is.
    return (
      <PageShell nav={<></>}>
        {isError ? (
          <Notice variant="error">We could not load your account. Please try again in a moment.</Notice>
        ) : (
          <Notice live>Loading…</Notice>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell
      nav={
        <>
          <HeaderLink to="/lms" end>
            My courses
          </HeaderLink>
          <HeaderLink to="/lms/add-course">Add a course</HeaderLink>
          <HeaderButton onClick={() => signOut.mutate()} disabled={signOut.isPending}>
            Sign out
          </HeaderButton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {signOut.isError && <Notice variant="error">We could not sign you out. Please try again.</Notice>}
        <Outlet context={student} />
      </div>
    </PageShell>
  );
}
