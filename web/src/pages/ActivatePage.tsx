import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { activationCodeFromHash } from '../activation-code-from-hash';
import { activate, ActivationError } from '../api/activations';
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
const NORMALISED_CODE = /^[A-HJ-NP-Z2-9]{15}$/;

const CODE_INVALID = 'This activation code is not valid. Check it and try again.';

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
      queryClient.setQueryData(['session'], student);
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
        maxLength={64}
        required
        error={errors.code?.message}
        {...register('code', {
          validate: (value) => {
            if (value.trim() === '') return 'Enter your activation code';
            return NORMALISED_CODE.test(value.replace(/[-\s]/g, '').toUpperCase()) || CODE_INVALID;
          },
        })}
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

export function ActivatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Read once, before the fragment is removed below.
  const [initialCode] = useState(() => activationCodeFromHash(location.hash));

  useEffect(() => {
    // The code is a secret: take it out of the address so it is not left in history or
    // copied along with the URL (ADR 020).
    if (location.hash) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  return (
    <PageShell>
      <div className="flex flex-col gap-8">
        <div className="max-w-form">
          <h1 className="type-heading text-brand">Activate your course</h1>
          <p className="type-body mt-4">Create your account to start learning.</p>
        </div>
        <OnboardingFormView initialCode={initialCode} />
      </div>
    </PageShell>
  );
}
