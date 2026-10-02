import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router';
import { fetchSession, login, LoginError, SESSION_KEY } from '../api/session';
import { lmsKeys } from '../use-student';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { PageShell } from '../ui/PageShell';

interface LoginForm {
  username: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ defaultValues: { username: '', password: '' } });

  const signIn = useMutation({
    mutationFn: login,
    // The request holds the password; do not keep it in the cache.
    gcTime: 0,
    onSuccess: (student) => {
      // Whatever an earlier student of this browser left behind goes first.
      queryClient.removeQueries({ queryKey: lmsKeys.all });
      queryClient.setQueryData(SESSION_KEY, student);
      // Always the dashboard: no destination is taken from the address (ADR 026).
      navigate('/lms', { replace: true });
    },
  });

  if (session.data) {
    return <Navigate to="/lms" replace />;
  }

  function submit({ username, password }: LoginForm) {
    signIn.mutate({ username: username.trim().toLowerCase(), password });
  }

  const rejected = signIn.error instanceof LoginError && signIn.error.status === 401;

  return (
    <PageShell>
      <div className="flex max-w-form flex-col gap-6">
        <h1 className="type-heading text-brand">Sign in</h1>
        {session.isPending ? (
          <Notice live>Loading…</Notice>
        ) : (
          <form
            noValidate
            onSubmit={handleSubmit(submit)}
            onChange={() => signIn.isError && signIn.reset()}
            className="flex flex-col gap-6"
          >
            {signIn.isError && (
              // One message for both fields: the API does not say which was wrong.
              <Notice variant="error">
                {rejected ? 'The username or password is not right.' : 'Something went wrong. Please try again.'}
              </Notice>
            )}
            <Field
              label="Username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              error={errors.username?.message}
              {...register('username', { validate: (value) => value.trim() !== '' || 'Enter your username.' })}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              error={errors.password?.message}
              {...register('password', { required: 'Enter your password.' })}
            />
            <Button type="submit" disabled={signIn.isPending}>
              {signIn.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
