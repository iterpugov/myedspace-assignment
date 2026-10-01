import type { CheckoutResponse, CourseResponse } from '@mes/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { CheckoutPage } from './CheckoutPage';
import { ConfirmationPage } from './ConfirmationPage';

const english: CourseResponse = {
  id: '0b9f6f0e-5d0a-4c58-9d0e-2f1c4a7b8e01',
  subject: 'English',
  yearFrom: 5,
  yearTo: 13,
  pricePence: 19900,
};
const maths: CourseResponse = {
  id: '4c1d2e3f-6a7b-4c8d-9e0f-1a2b3c4d5e02',
  subject: 'Maths',
  yearFrom: 5,
  yearTo: 13,
  pricePence: 19900,
};
const science: CourseResponse = {
  id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c03',
  subject: 'Science',
  yearFrom: 5,
  yearTo: 11,
  pricePence: 19900,
};
const unknownCourseId = '7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b04';

const activationCode = 'ABCDE-FGHJK-MNPQR';
const paidOrder: CheckoutResponse = {
  orderId: '2e1d0c9b-8a7f-4e6d-9c5b-4a3f2e1d0c05',
  totalPence: 19900,
  seats: [{ courseId: maths.id, subject: 'Maths', year: 7, pricePence: 19900, activationCode }],
};

const mathsYear7 = `/checkout?courseId=${maths.id}&year=7`;

type OrderReply = () => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const created: OrderReply = () => json(paidOrder, 201);
const failed =
  (status: number): OrderReply =>
  () =>
    json({ statusCode: status, message: 'Request failed' }, status);

/** GET /api/courses always answers with the catalogue; POST /api/orders answers as the test says. */
function stubApi(orderReply: OrderReply = created) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (input === '/api/courses' && method === 'GET') {
      return json([english, maths, science]);
    }
    if (input === '/api/orders' && method === 'POST') {
      return orderReply();
    }
    throw new Error(`Unexpected request: ${method} ${String(input)}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function orderRequests(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.filter(([input]) => input === '/api/orders');
}

/** Lets a test step back in history from the confirmation, to see what "Back" lands on. */
function BackProbe() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Test: go back
    </button>
  );
}

function renderCheckout(...initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}>
        <Routes>
          <Route path="/" element={<p data-testid="product-page">Product page</p>} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route
            path="/checkout/confirmation"
            element={
              <>
                <ConfirmationPage />
                <BackProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const nameField = () => screen.getByRole('textbox', { name: 'Your name' });
const emailField = () => screen.getByRole('textbox', { name: 'Email address' });
const payButton = () => screen.findByRole('button', { name: 'Pay £199' });

describe('CheckoutPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the summary of the selection: Maths, Year 7, £199 (PUR-3)', async () => {
    const fetchMock = stubApi();

    renderCheckout(mathsYear7);

    expect(await screen.findByText('Maths')).toBeInTheDocument();
    expect(screen.getByText('Year 7')).toBeInTheDocument();
    expect(screen.getByText('£199')).toBeInTheDocument();
    expect(nameField()).toHaveValue('');
    expect(emailField()).toHaveValue('');
    expect(await payButton()).toBeEnabled();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/courses');
  });

  it.each([
    ['no courseId', '/checkout?year=7'],
    ['an unknown courseId', `/checkout?courseId=${unknownCourseId}&year=7`],
    ['no year', `/checkout?courseId=${maths.id}`],
    ['a non-numeric year', `/checkout?courseId=${maths.id}&year=seven`],
    ['a fractional year', `/checkout?courseId=${maths.id}&year=7.5`],
    ["a year above the course's range", `/checkout?courseId=${science.id}&year=12`],
    ["a year below the course's range", `/checkout?courseId=${science.id}&year=4`],
    ['no selection at all', '/checkout'],
  ])('shows a notice with a link back and no form for %s', async (_case, url) => {
    stubApi();

    renderCheckout(url);

    expect(await screen.findByText('We could not find that course and year.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose a course' })).toHaveAttribute('href', '/');
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /pay/i })).not.toBeInTheDocument();
  });

  it('shows a required error on each field and sends no order when submitted empty', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderCheckout(mathsYear7);

    await user.click(await payButton());

    expect(await screen.findByText('Enter your name')).toBeInTheDocument();
    expect(screen.getByText('Enter your email address')).toBeInTheDocument();
    expect(nameField()).toHaveAttribute('aria-invalid', 'true');
    expect(nameField()).toHaveAccessibleDescription(/Enter your name/);
    expect(emailField()).toHaveAttribute('aria-invalid', 'true');
    expect(emailField()).toHaveAccessibleDescription(/Enter your email address/);
    expect(orderRequests(fetchMock)).toHaveLength(0);
  });

  it('treats a name of spaces only as missing and sends no order', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderCheckout(mathsYear7);
    await payButton();

    await user.type(nameField(), '   ');
    await user.type(emailField(), 'pat@example.com');
    await user.click(await payButton());

    expect(await screen.findByText('Enter your name')).toBeInTheDocument();
    expect(orderRequests(fetchMock)).toHaveLength(0);
  });

  it('shows an error for an invalid email and sends no order', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderCheckout(mathsYear7);
    await payButton();

    await user.type(nameField(), 'Pat Parent');
    await user.type(emailField(), 'not-an-email');
    await user.click(await payButton());

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(emailField()).toHaveAttribute('aria-invalid', 'true');
    expect(emailField()).toHaveAccessibleDescription(/Enter a valid email address/);
    expect(nameField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Enter your name')).not.toBeInTheDocument();
    expect(orderRequests(fetchMock)).toHaveLength(0);
  });

  it('sends POST /api/orders with the trimmed details and one seat, year as a number (PUR-3)', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderCheckout(mathsYear7);
    await payButton();

    await user.type(nameField(), '  Pat Parent ');
    await user.type(emailField(), 'pat@example.com');
    await user.click(await payButton());

    await waitFor(() => expect(orderRequests(fetchMock)).toHaveLength(1));
    const [url, init] = orderRequests(fetchMock)[0];
    expect(url).toBe('/api/orders');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      parentName: 'Pat Parent',
      parentEmail: 'pat@example.com',
      seats: [{ courseId: maths.id, year: 7 }],
    });
  });

  it('shows the activation code and a link ending in /activate#code=<code> after payment (PUR-4)', async () => {
    const user = userEvent.setup();
    stubApi(created);
    renderCheckout(mathsYear7);
    await payButton();

    await user.type(nameField(), 'Pat Parent');
    await user.type(emailField(), 'pat@example.com');
    await user.click(await payButton());

    expect(await screen.findByRole('heading', { name: 'Payment complete' })).toBeInTheDocument();
    expect(screen.getByText(activationCode)).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/activate#code=${activationCode}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay/i })).not.toBeInTheDocument();
  });

  it('replaces the checkout in history, so Back from the confirmation skips the payment form (ADR 020)', async () => {
    const user = userEvent.setup();
    stubApi(created);
    renderCheckout('/', mathsYear7);
    await payButton();

    await user.type(nameField(), 'Pat Parent');
    await user.type(emailField(), 'pat@example.com');
    await user.click(await payButton());
    await screen.findByRole('heading', { name: 'Payment complete' });
    await user.click(screen.getByRole('button', { name: 'Test: go back' }));

    expect(await screen.findByTestId('product-page')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay/i })).not.toBeInTheDocument();
  });

  it.each([422, 500])(
    'shows an alert, keeps the typed values and re-enables the button after a %i response',
    async (status) => {
      const user = userEvent.setup();
      const fetchMock = stubApi(failed(status));
      renderCheckout(mathsYear7);
      await payButton();

      await user.type(nameField(), 'Pat Parent');
      await user.type(emailField(), 'pat@example.com');
      await user.click(await payButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not complete your order. Please try again.',
      );
      expect(orderRequests(fetchMock)).toHaveLength(1);
      expect(nameField()).toHaveValue('Pat Parent');
      expect(emailField()).toHaveValue('pat@example.com');
      expect(await payButton()).toBeEnabled();
      expect(screen.queryByRole('heading', { name: 'Payment complete' })).not.toBeInTheDocument();
      expect(document.body).not.toHaveTextContent(activationCode);
    },
  );

  it('disables the pay button while the order request is pending', async () => {
    const user = userEvent.setup();
    let respond: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      respond = resolve;
    });
    const fetchMock = stubApi(() => pending);
    renderCheckout(mathsYear7);
    await payButton();

    await user.type(nameField(), 'Pat Parent');
    await user.type(emailField(), 'pat@example.com');
    await user.click(await payButton());

    await waitFor(() => expect(orderRequests(fetchMock)).toHaveLength(1));
    const button = screen.getByRole('button', { name: /pay/i });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(orderRequests(fetchMock)).toHaveLength(1);

    respond(json(paidOrder, 201));
    expect(await screen.findByRole('heading', { name: 'Payment complete' })).toBeInTheDocument();
  });
});
