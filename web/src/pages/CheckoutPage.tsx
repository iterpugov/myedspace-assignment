import type { CourseResponse } from '@mes/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { fetchCourses } from '../api/courses';
import { createOrder, OrderError } from '../api/orders';
import { formatPrice } from '../format-price';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { PageShell } from '../ui/PageShell';
import { TextLink } from '../ui/TextLink';

interface Selection {
  course: CourseResponse;
  year: number;
}

/**
 * The course and year named in the URL, if they make sense together. The URL is editable,
 * so this only decides what to show; the server checks the same rule when the order is made.
 */
function findSelection(courses: CourseResponse[], params: URLSearchParams): Selection | undefined {
  const course = courses.find((candidate) => candidate.id === params.get('courseId'));
  const yearText = params.get('year') ?? '';
  if (!course || !/^\d+$/.test(yearText)) return undefined;

  const year = Number(yearText);
  return year >= course.yearFrom && year <= course.yearTo ? { course, year } : undefined;
}

interface ParentDetails {
  parentName: string;
  parentEmail: string;
}

function CheckoutForm({ course, year }: Selection) {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ParentDetails>({ defaultValues: { parentName: '', parentEmail: '' } });

  const order = useMutation({
    mutationFn: createOrder,
    // The response holds plain activation codes; do not keep it in the cache (ADR 020).
    gcTime: 0,
    // Replacing the entry keeps "Back" from returning to a form that would charge again.
    onSuccess: (paid) => navigate('/checkout/confirmation', { replace: true, state: { order: paid } }),
  });

  function pay({ parentName, parentEmail }: ParentDetails) {
    order.mutate({
      parentName: parentName.trim(),
      parentEmail: parentEmail.trim(),
      seats: [{ courseId: course.id, year }],
    });
  }

  return (
    <div className="flex max-w-form flex-col gap-8">
      <Card label="Your order">
        <p className="type-subheading">{course.subject}</p>
        <p className="type-body">Year {year}</p>
        <p className="type-subheading mt-2">{formatPrice(course.pricePence)}</p>
      </Card>

      <form noValidate onSubmit={handleSubmit(pay)} className="flex flex-col gap-6">
        <h2 className="type-subheading text-brand">Your details</h2>
        <Field
          label="Your name"
          autoComplete="name"
          required
          maxLength={100}
          error={errors.parentName?.message}
          {...register('parentName', {
            validate: (value) => value.trim() !== '' || 'Enter your name',
          })}
        />
        <Field
          label="Email address"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          error={errors.parentEmail?.message}
          {...register('parentEmail', {
            validate: (value) => {
              const email = value.trim();
              if (email === '') return 'Enter your email address';
              return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || 'Enter a valid email address';
            },
          })}
        />

        {order.isError && (
          <Notice variant="error">
            {order.error instanceof OrderError && order.error.status === 400
              ? 'Check your name and email address, then try again.'
              : 'We could not complete your order. Please try again.'}
          </Notice>
        )}

        <p className="type-small text-ink/70">This is a mock checkout: no card is needed and no money is taken.</p>
        <div>
          <Button type="submit" disabled={order.isPending}>
            {order.isPending ? 'Paying…' : `Pay ${formatPrice(course.pricePence)}`}
          </Button>
        </div>
      </form>

      <TextLink to="/">← Back to courses</TextLink>
    </div>
  );
}

export function CheckoutPage() {
  const [params] = useSearchParams();
  const { data: courses, isError } = useQuery({ queryKey: ['courses'], queryFn: fetchCourses });
  const selection = courses && findSelection(courses, params);

  return (
    <PageShell>
      <h1 className="type-heading mb-8 text-brand">Checkout</h1>
      {selection ? (
        <CheckoutForm {...selection} />
      ) : (
        <div className="flex max-w-form flex-col gap-6">
          {courses ? (
            <>
              <Notice>We could not find that course and year.</Notice>
              <TextLink to="/">Choose a course</TextLink>
            </>
          ) : isError ? (
            <Notice variant="error">We could not load your order. Please try again in a moment.</Notice>
          ) : (
            <Notice live>Loading your order…</Notice>
          )}
        </div>
      )}
    </PageShell>
  );
}
