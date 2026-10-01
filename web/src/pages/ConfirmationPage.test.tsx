import type { CheckoutResponse } from '@mes/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ConfirmationPage } from './ConfirmationPage';

const activationCode = 'ABCDE-FGHJK-MNPQR';
const order: CheckoutResponse = {
  orderId: '2e1d0c9b-8a7f-4e6d-9c5b-4a3f2e1d0c05',
  totalPence: 19900,
  seats: [
    {
      courseId: '4c1d2e3f-6a7b-4c8d-9e0f-1a2b3c4d5e02',
      subject: 'Maths',
      year: 7,
      pricePence: 19900,
      activationCode,
    },
  ],
};

function renderConfirmation(state?: { order: CheckoutResponse }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: '/checkout/confirmation', state }]}>
        <Routes>
          <Route path="/" element={<p data-testid="product-page">Product page</p>} />
          <Route path="/checkout/confirmation" element={<ConfirmationPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ConfirmationPage', () => {
  it('shows the activation code, the activation link and the notice to save the code (PUR-4)', () => {
    renderConfirmation({ order });

    expect(screen.getByRole('heading', { name: 'Payment complete' })).toBeInTheDocument();
    expect(screen.getByText(activationCode)).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/activate#code=${activationCode}`)).toBeInTheDocument();
    expect(screen.getByText(/Save this code now/)).toBeInTheDocument();
    expect(screen.queryByText('There is no order to show.')).not.toBeInTheDocument();
  });

  it('shows a notice and a link to the courses, and no code, when opened without an order (ADR 020)', () => {
    renderConfirmation();

    expect(screen.getByText('There is no order to show.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose a course' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('heading', { name: 'Payment complete' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Save this code now/)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('/activate#code=');
    expect(document.body).not.toHaveTextContent(/[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){2}/);
  });
});
