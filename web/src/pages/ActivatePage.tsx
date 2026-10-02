import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { activationCodeFromHash } from '../activation-code-from-hash';
import { CODE_INPUT_MAX_LENGTH, CODE_INVALID, validateActivationCode } from '../activation-code-rules';
import { activate, ActivationError } from '../api/activations';
import { fetchSession, SESSION_KEY } from '../api/session';
import type { CarriedActivationCode } from '../carried-activation-code';
import { lmsKeys } from '../use-student';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { PageShell } from '../ui/PageShell';
import { TextLink } from '../ui/TextLink';

interface OnboardingForm {
  code: string;
  firstName: string;
  username: string;
  password: string;
  repeatPassword: string;
}

// The same rules the API enforces; here they only save a round trip.
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const normaliseUsername = (value: string) => value.trim().toLowerCase();

function OnboardingFormView({ initialCode }: { initialCode: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<OnboardingForm>({
    defaultValues: { code: initialCode, firstName: '', username: '', password: '', repeatPassword: '' },
  });

  const activation = useMutation({
    mutationFn: activate,
    // The request holds the password and the code; keep neither in the cache (ADR 020).
    gcTime: 0,
    onSuccess: (student) => {
      // Whatever an earlier student of this browser left behind goes first.
      queryClient.removeQueries({ queryKey: lmsKeys.all });
      queryClient.setQueryData(SESSION_KEY, student);
      // Replacing the entry keeps "Back" from returning to a form with a used code.
      navigate('/lms', { replace: true });
    },
    onError: (error) => {
      // Errors about one field go to that field: the form then focuses it, and clears the
      // message as soon as the student edits the value.
      const reason = error instanceof ActivationError ? error.reason : undefined;
      if (reason === 'username_taken') {
        setError('username', { type: 'server', message: 'That username is taken. Choose another.' }, { shouldFocus: true });
      }
      if (reason === 'code_invalid') {
        setError('code', { type: 'server', message: CODE_INVALID }, { shouldFocus: true });
      }
    },
  });

  /** Drops a notice from the last attempt once the student starts correcting the form. */
  function clearLastFailure() {
    if (activation.isError) activation.reset();
  }

  function submit({ code, firstName, username, password }: OnboardingForm) {
    activation.mutate({
      code: code.trim(),
      firstName: firstName.trim(),
      username: normaliseUsername(username),
      password,
    });
  }

  const failure = activation.error;
  const reason = failure instanceof ActivationError ? failure.reason : undefined;
  const status = failure instanceof ActivationError ? failure.status : undefined;

  return (
    <form noValidate onSubmit={handleSubmit(submit)} onChange={clearLastFailure} className="flex max-w-form flex-col gap-6">
      <Field
        label="Activation code"
        hint="It is filled in when you open the link from your parent."
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={CODE_INPUT_MAX_LENGTH}
        required
        error={errors.code?.message}
        {...register('code', { validate: validateActivationCode })}
      />
      <Field
        label="First name"
        autoComplete="given-name"
        maxLength={50}
        required
        error={errors.firstName?.message}
        {...register('firstName', { validate: (value) => value.trim() !== '' || 'Enter your first name' })}
      />
      <Field
        label="Username"
        hint="3 to 20 letters, numbers or underscores. You will use it to sign in."
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        error={errors.username?.message}
        {...register('username', {
          validate: (value) => {
            const username = normaliseUsername(value);
            if (username === '') return 'Enter a username';
            return USERNAME_PATTERN.test(username) || 'Use 3 to 20 letters, numbers or underscores';
          },
        })}
      />
      <Field
        label="Password"
        type="password"
        hint="At least 8 characters. Keep it safe: it cannot be reset."
        autoComplete="new-password"
        required
        error={errors.password?.message}
        {...register('password', {
          // Changing the password re-checks the repeat field.
          deps: ['repeatPassword'],
          // No maxLength on the input: it would silently cut a long pasted password.
          validate: (value) => {
            if (value === '') return 'Enter a password';
            if (value.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters`;
            return value.length <= PASSWORD_MAX_LENGTH || `Use at most ${PASSWORD_MAX_LENGTH} characters`;
          },
        })}
      />
      <Field
        label="Repeat password"
        type="password"
        autoComplete="new-password"
        required
        error={errors.repeatPassword?.message}
        {...register('repeatPassword', {
          validate: (value, form) => {
            if (value === '') return 'Repeat your password';
            return value === form.password || 'The passwords do not match';
          },
        })}
      />

      {reason === 'code_used' ? (
        <>
          <Notice variant="error">This code has already been used.</Notice>
          <TextLink to="/login">Sign in</TextLink>
        </>
      ) : (
        failure &&
        reason === undefined && (
          <Notice variant="error">
            {status === 400
              ? 'Check the details and try again.'
              : 'We could not create your account. Please try again.'}
          </Notice>
        )
      )}

      <div>
        <Button type="submit" disabled={activation.isPending}>
          {activation.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </div>
    </form>
  );
}

/** What the link opens: not known until the session answers, then fixed. */
type Destination = 'undecided' | 'onboarding' | 'add-course';

export function ActivatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Read once, before the fragment is removed below.
  const [initialCode] = useState(() => activationCodeFromHash(location.hash));
  // One attempt for a request this page starts: when the session cannot be read, the link
  // opens the form as it always did.
  const session = useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, retry: false });
  const [destination, setDestination] = useState<Destination>('undecided');

  // An answer from the API, not a value left in the cache by an earlier page.
  const sessionKnown = !session.isPending && !session.isFetching;
  const signedIn = Boolean(session.data);

  // Every navigation this page makes before the form is used happens here, at most one per
  // run: a second one in the same pass would cancel the first.
  useEffect(() => {
    // On the way to "Add a course": nothing more to do on this page.
    if (destination === 'add-course') return;

    // Decided once, on the first answer. The session changes later — this very form signs
    // the student in — and that must not send them on with a code they have just used.
    if (destination === 'undecided' && sessionKnown) {
      if (signedIn && initialCode !== '') {
        // A signed-in student adds the course to their account instead of creating another
        // one (ADR 029). Router state keeps the code out of the address, and replacing the
        // entry leaves no way "Back" to a link with the code in it.
        const state: CarriedActivationCode = { activationCode: initialCode };
        setDestination('add-course');
        navigate('/lms/add-course', { replace: true, state });
        return;
      }
      setDestination('onboarding');
    }

    // The code is a secret: take it out of the address so it is not left in history or
    // copied along with the URL (ADR 020). It is already held in state above.
    if (location.hash) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    }
  }, [destination, sessionKnown, signedIn, initialCode, location.hash, location.pathname, location.search, navigate]);

  if (destination !== 'onboarding') {
    return (
      <PageShell>
        <Notice live>Loading…</Notice>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-8">
        <div className="max-w-form">
          <h1 className="type-heading text-brand">Activate your course</h1>
          <p className="type-body mt-4">Create your account to start learning.</p>
          {/* The code is not carried through sign-in (ADR 027, 029): after signing in the student
              opens the link again or pastes the code. */}
          <p className="type-body mt-2">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-brand underline outline-offset-2 focus-visible:outline-2 focus-visible:outline-brand"
            >
              Sign in
            </Link>
            , choose Add a course and paste this code.
          </p>
        </div>
        <OnboardingFormView initialCode={initialCode} />
      </div>
    </PageShell>
  );
}
