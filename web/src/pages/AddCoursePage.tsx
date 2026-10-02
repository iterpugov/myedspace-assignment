import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { CODE_INPUT_MAX_LENGTH, CODE_INVALID, validateActivationCode } from '../activation-code-rules';
import { carriedActivationCode } from '../carried-activation-code';
import { redeemCode, RedemptionError } from '../api/activations';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { TextLink } from '../ui/TextLink';
import { useSessionExpiry } from '../use-session-expiry';
import { lmsKeys, useStudent } from '../use-student';

interface AddCourseForm {
  code: string;
}

/**
 * Adds a course to the signed-in student's account with an activation code (ADR 027). A
 * student who opened an activation link while signed in arrives with the code filled in
 * (ADR 029); it is only filled in, and nothing is added until they submit.
 */
export function AddCoursePage() {
  const student = useStudent();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  // Read once: the field is the student's to edit from here on.
  const [carriedCode] = useState(() => carriedActivationCode(location.state));
  const hasRouterState = location.state !== null;

  useEffect(() => {
    // The code is a secret (ADR 020): once it is in the field, take it out of the history
    // entry, so "Back" to this page — after leaving it, or for the next student at a shared
    // browser — finds an empty form. The price: a reload loses the prefill.
    if (hasRouterState) navigate(location.pathname, { replace: true, state: null });
  }, [hasRouterState, location.pathname, navigate]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AddCourseForm>({ defaultValues: { code: carriedCode } });

  const redemption = useMutation({
    mutationFn: redeemCode,
    // The request holds the code; do not keep it in the cache (ADR 020).
    gcTime: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lmsKeys.courses(student.id) }),
    onError: (error) => {
      if (error instanceof RedemptionError && error.reason === 'code_invalid') {
        setError('code', { type: 'server', message: CODE_INVALID }, { shouldFocus: true });
      }
    },
  });
  const sessionExpired = useSessionExpiry(redemption.error);

  const failure = redemption.error;
  const reason = failure instanceof RedemptionError ? failure.reason : undefined;

  return (
    <div className="flex max-w-form flex-col gap-6">
      {/* Names the account: at a shared browser the course goes to whoever is signed in. */}
      <h1 className="type-heading text-brand">Add a course to {student.firstName}’s account</h1>
      {carriedCode !== '' && (
        <>
          <Notice live>
            The code from your link is filled in. Press Add course to add it to {student.firstName}’s account.
          </Notice>
          {/* The link may have been meant for a new account, e.g. a sibling at a shared browser. */}
          <p className="type-body">Not {student.firstName}? Sign out, then open your link again.</p>
        </>
      )}
      <form
        noValidate
        onSubmit={handleSubmit(({ code }) =>
          redemption.mutate(
            { code: code.trim() },
            // Given here, not to the hook, so it is skipped if the student has left the page.
            // The new card on the dashboard is the confirmation; replacing the entry keeps
            // "Back" from returning to a form with a used code.
            { onSuccess: () => navigate('/lms', { replace: true }) },
          ),
        )}
        onChange={() => redemption.isError && redemption.reset()}
        className="flex flex-col gap-6"
      >
        <Field
          label="Activation code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={CODE_INPUT_MAX_LENGTH}
          required
          error={errors.code?.message}
          {...register('code', { validate: validateActivationCode })}
        />

        {reason === 'course_already_owned' ? (
          <Notice variant="error">
            You already have this course for this year. This purchase is a duplicate: ask your parent to contact us.
            The code has not been used.
          </Notice>
        ) : reason === 'code_used' ? (
          <Notice variant="error">This code has already been used.</Notice>
        ) : sessionExpired ? (
          <Notice live>Loading…</Notice>
        ) : (
          failure &&
          reason === undefined && <Notice variant="error">Something went wrong. Please try again.</Notice>
        )}

        <div>
          <Button type="submit" disabled={redemption.isPending}>
            {redemption.isPending ? 'Adding…' : 'Add course'}
          </Button>
        </div>
      </form>
      <TextLink to="/lms">← Back to my courses</TextLink>
    </div>
  );
}
