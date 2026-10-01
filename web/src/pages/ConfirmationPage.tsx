import type { CheckoutResponse } from '@mes/contracts';
import { useLocation } from 'react-router';
import { activationLink } from '../activation-link';
import { formatPrice } from '../format-price';
import { Card } from '../ui/Card';
import { Notice } from '../ui/Notice';
import { PageShell } from '../ui/PageShell';
import { TextLink } from '../ui/TextLink';

/**
 * The paid order arrives in router state, the only place the plain codes are kept:
 * they are not stored on the server and must not reach a URL or browser storage.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPaidOrder(value: unknown): value is CheckoutResponse {
  return (
    isRecord(value) &&
    typeof value.totalPence === 'number' &&
    Array.isArray(value.seats) &&
    value.seats.every(
      (seat: unknown) =>
        isRecord(seat) &&
        typeof seat.activationCode === 'string' &&
        typeof seat.subject === 'string' &&
        typeof seat.year === 'number',
    )
  );
}

function orderFrom(state: unknown): CheckoutResponse | undefined {
  return isRecord(state) && isPaidOrder(state.order) ? state.order : undefined;
}

export function ConfirmationPage() {
  const order = orderFrom(useLocation().state);

  if (!order) {
    return (
      <PageShell>
        <div className="flex max-w-form flex-col gap-6">
          <h1 className="type-heading text-brand">Order confirmation</h1>
          <Notice>There is no order to show.</Notice>
          <TextLink to="/">Choose a course</TextLink>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex max-w-form flex-col gap-8">
        <div>
          <h1 className="type-heading text-brand">Payment complete</h1>
          <p className="type-body mt-4">
            You paid {formatPrice(order.totalPence)}. Pass the activation link or the code to your child: they
            use it to create their account and start learning.
          </p>
        </div>

        <Notice>
          <strong>Save this code now.</strong> It is shown only once and cannot be recovered later.
        </Notice>

        {order.seats.map((seat) => (
          <Card key={seat.activationCode} label={`${seat.subject} · Year ${seat.year}`}>
            <p className="type-label mt-2">Activation code</p>
            <p className="type-subheading text-brand">{seat.activationCode}</p>
            <p className="type-label mt-4">Activation link</p>
            <a
              href={activationLink(seat.activationCode)}
              className="type-body break-all text-brand underline outline-offset-2 focus-visible:outline-2 focus-visible:outline-brand"
            >
              {activationLink(seat.activationCode)}
            </a>
          </Card>
        ))}

        <TextLink to="/">← Back to courses</TextLink>
      </div>
    </PageShell>
  );
}
