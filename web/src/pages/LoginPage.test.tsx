import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { deferredReply, fakePassword, json, requestsTo, sam, stubApi, unauthorized, type Reply } from '../test/api';
import { LoginPage } from './LoginPage';

const invalidCredentials: Reply = () =>
  json({ statusCode: 401, message: 'Invalid username or password', error: 'Unauthorized' }, 401);

/**
 * POST /api/session answers as the test says. GET /api/session behaves like the real API:
 * 401 until a login has succeeded (or from the start when `signedIn` is true), then the student.
 */
function stubLoginApi(loginReply: Reply = () => json(sam), { signedIn = false } = {}) {
  let hasSession = signedIn;
  return stubApi({
    'GET /api/session': () => (hasSession ? json(sam) : unauthorized()),
    'POST /api/session': async (init) => {
      const response = await loginReply(init);
      if (response.status === 200) hasSession = true;
      return response;
    },
  });
}

const loginRequests = (fetchMock: ReturnType<typeof stubLoginApi>) => requestsTo(fetchMock, 'POST', '/api/session');

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/lms" element={<p data-testid="lms-page">LMS page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

// The form may appear only once the session check has answered, hence the async lookup.
const findUsernameField = () => screen.findByRole('textbox', { name: 'Username' });
const usernameField = () => screen.getByRole('textbox', { name: 'Username' });
// Password inputs have no textbox role, so they are found by their label.
const passwordField = () => screen.getByLabelText('Password');
// The header's "Sign in" is a link; the form's is the only button with that name.
const submitButton = () => screen.getByRole('button', { name: 'Sign in' });

describe('LoginPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows a required error under each field and sends no request when submitted empty', async () => {
    const user = userEvent.setup();
    const fetchMock = stubLoginApi();
    renderLogin();
    await findUsernameField();
    expect(passwordField()).toHaveAttribute('type', 'password');

    await user.click(submitButton());

    await waitFor(() => expect(usernameField()).toHaveAttribute('aria-invalid', 'true'));
    expect(usernameField()).toHaveAccessibleDescription(/Enter your username\./);
    expect(passwordField()).toHaveAttribute('aria-invalid', 'true');
    expect(passwordField()).toHaveAccessibleDescription(/Enter your password\./);
    expect(loginRequests(fetchMock)).toHaveLength(0);
  });

  it('sends POST /api/session with a trimmed, lower-cased username and the password untouched, and nothing else', async () => {
    const user = userEvent.setup();
    const fetchMock = stubLoginApi();
    const spacedPassword = ` ${fakePassword} `;
    renderLogin();

    await user.type(await findUsernameField(), ' Sam_07 ');
    await user.type(passwordField(), spacedPassword);
    await user.click(submitButton());

    await waitFor(() => expect(loginRequests(fetchMock)).toHaveLength(1));
    const [url, init] = loginRequests(fetchMock)[0];
    expect(url).toBe('/api/session');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({ username: 'sam_07', password: spacedPassword });
  });

  it('takes the student to /lms after a 200 (LMS-1)', async () => {
    const user = userEvent.setup();
    stubLoginApi(() => json(sam));
    renderLogin();

    await user.type(await findUsernameField(), sam.username);
    await user.type(passwordField(), fakePassword);
    await user.click(submitButton());

    expect(await screen.findByTestId('lms-page')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Username' })).not.toBeInTheDocument();
  });

  it('shows one alert that names neither field, keeps the username and re-enables the button after a 401', async () => {
    const user = userEvent.setup();
    const fetchMock = stubLoginApi(invalidCredentials);
    renderLogin();

    await user.type(await findUsernameField(), sam.username);
    await user.type(passwordField(), 'wrong-test-password');
    await user.click(submitButton());

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('The username or password is not right.');
    expect(usernameField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(passwordField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(usernameField()).toHaveValue(sam.username);
    expect(submitButton()).toBeEnabled();
    expect(loginRequests(fetchMock)).toHaveLength(1);
    expect(screen.queryByTestId('lms-page')).not.toBeInTheDocument();
  });

  it('shows the generic alert after a 500', async () => {
    const user = userEvent.setup();
    stubLoginApi(() => json({ statusCode: 500, message: 'Internal server error' }, 500));
    renderLogin();

    await user.type(await findUsernameField(), sam.username);
    await user.type(passwordField(), fakePassword);
    await user.click(submitButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong. Please try again.');
    expect(alert).not.toHaveTextContent('The username or password is not right.');
    expect(submitButton()).toBeEnabled();
    expect(screen.queryByTestId('lms-page')).not.toBeInTheDocument();
  });

  it('disables the button while the request is pending', async () => {
    const user = userEvent.setup();
    const login = deferredReply();
    const fetchMock = stubLoginApi(login.reply);
    renderLogin();

    await user.type(await findUsernameField(), sam.username);
    await user.type(passwordField(), fakePassword);
    await user.click(submitButton());

    await waitFor(() => expect(loginRequests(fetchMock)).toHaveLength(1));
    // The label may change while pending ("Signing in…"), so the name is matched loosely.
    const button = screen.getByRole('button', { name: /sign(ing)? in/i });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(loginRequests(fetchMock)).toHaveLength(1);

    login.respond(json(sam));
    expect(await screen.findByTestId('lms-page')).toBeInTheDocument();
  });

  it("drops another student's cached LMS data when someone signs in at the same browser", async () => {
    const user = userEvent.setup();
    stubLoginApi(() => json(sam));
    const queryClient = renderLogin();
    // Left behind by a student whose session ended without "Sign out".
    queryClient.setQueryData(['lms', 'another-student', 'courses'], [{ subject: 'English' }]);

    await user.type(await findUsernameField(), sam.username);
    await user.type(passwordField(), fakePassword);
    await user.click(submitButton());

    expect(await screen.findByTestId('lms-page')).toBeInTheDocument();
    expect(queryClient.getQueryCache().findAll({ queryKey: ['lms'] })).toHaveLength(0);
  });

  it('sends a student who is already signed in to /lms without a login request', async () => {
    const fetchMock = stubLoginApi(undefined, { signedIn: true });

    renderLogin();

    expect(await screen.findByTestId('lms-page')).toBeInTheDocument();
    expect(loginRequests(fetchMock)).toHaveLength(0);
  });
});
