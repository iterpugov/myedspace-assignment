import type { ActivationFailureReason, StudentResponse } from '@mes/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { RequireSession } from '../RequireSession';
import { ActivatePage } from './ActivatePage';
import { LmsPage } from './LmsPage';

const activationCode = 'ABCDE-FGHJK-MNPQR';
const activateLink = `/activate#code=${activationCode}`;
/** Not a real credential: a made-up value used only to fill the form in tests. */
const fakePassword = 'test-only-password';

const sam: StudentResponse = {
  id: '5f4e3d2c-1b0a-4f9e-8d7c-6b5a4f3e2d06',
  username: 'sam_07',
  firstName: 'Sam',
};

type ActivationReply = () => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const created: ActivationReply = () => json(sam, 201);
const refused =
  (status: number, reason?: ActivationFailureReason): ActivationReply =>
  () =>
    json({ statusCode: status, message: 'Request failed', ...(reason ? { reason } : {}) }, status);

/**
 * POST /api/activations answers as the test says. GET /api/session behaves like the real
 * API: 401 until an activation has succeeded, then the student. GET /api/lms/courses is what
 * the dashboard asks for once the student lands on /lms; it answers with no courses.
 */
function stubApi(activationReply: ActivationReply = created) {
  let signedIn = false;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (input === '/api/activations' && method === 'POST') {
      const response = await activationReply();
      if (response.status === 201) signedIn = true;
      return response;
    }
    if (input === '/api/session' && method === 'GET') {
      return signedIn ? json(sam) : json({ statusCode: 401, message: 'Unauthorized' }, 401);
    }
    if (input === '/api/lms/courses' && method === 'GET') {
      return signedIn ? json([]) : json({ statusCode: 401, message: 'Unauthorized' }, 401);
    }
    throw new Error(`Unexpected request: ${method} ${String(input)}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function activationRequests(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.filter(([input]) => input === '/api/activations');
}

/** Shows the router's current address, and lets a test step back in history. */
function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</output>
      <button type="button" onClick={() => navigate(-1)}>
        Test: go back
      </button>
    </>
  );
}

function renderActivate(...initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}>
        <Routes>
          <Route path="/" element={<p data-testid="product-page">Product page</p>} />
          <Route
            path="/activate"
            element={
              <>
                <ActivatePage />
                <LocationProbe />
              </>
            }
          />
          <Route element={<RequireSession />}>
            <Route path="/lms" element={<LmsPage />} />
          </Route>
          <Route path="/login" element={<p data-testid="login-page">Login page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const address = () => screen.getByTestId('location').textContent;
const codeField = () => screen.getByRole('textbox', { name: 'Activation code' });
const firstNameField = () => screen.getByRole('textbox', { name: 'First name' });
const usernameField = () => screen.getByRole('textbox', { name: 'Username' });
// Password inputs have no textbox role, so they are found by their label.
const passwordField = () => screen.getByLabelText('Password');
const repeatPasswordField = () => screen.getByLabelText('Repeat password');
const submitButton = () => screen.getByRole('button', { name: 'Create account' });

interface FormValues {
  code?: string;
  firstName?: string;
  username?: string;
  password?: string;
  repeatPassword?: string;
}

/** Types into every field that is given a non-empty value; the code is skipped when prefilled. */
async function fillForm(user: UserEvent, values: FormValues = {}) {
  const { code, firstName = 'Sam', username = 'sam_07', password = fakePassword } = values;
  const repeatPassword = values.repeatPassword ?? password;
  if (code) await user.type(codeField(), code);
  if (firstName) await user.type(firstNameField(), firstName);
  if (username) await user.type(usernameField(), username);
  if (password) await user.type(passwordField(), password);
  if (repeatPassword) await user.type(repeatPasswordField(), repeatPassword);
}

function expectFormKeptItsValues() {
  expect(codeField()).toHaveValue(activationCode);
  expect(firstNameField()).toHaveValue('Sam');
  expect(usernameField()).toHaveValue('sam_07');
  expect(passwordField()).toHaveValue(fakePassword);
  expect(repeatPasswordField()).toHaveValue(fakePassword);
}

/**
 * The "Sign in" link the form shows after a used code. The header has its own, and the page
 * has a standing one above the form ("Already have an account?"); both are always there.
 */
function signInLinkInForm(mode: 'get' | 'query') {
  const form = submitButton().closest('form');
  if (!form) throw new Error('The submit button is not inside a form');
  const inForm = within(form);
  return mode === 'get'
    ? inForm.getByRole('link', { name: 'Sign in' })
    : inForm.queryByRole('link', { name: 'Sign in' });
}

describe('ActivatePage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fills the code field from #code=<code> and removes the fragment from the address (ONB-1, ADR 020)', async () => {
    const fetchMock = stubApi();

    renderActivate(activateLink);

    expect(screen.getByRole('heading', { name: 'Activate your course' })).toBeInTheDocument();
    await waitFor(() => expect(address()).toBe('/activate'));
    expect(codeField()).toHaveValue(activationCode);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('replaces the history entry, so Back does not return to an address holding the code (ADR 020)', async () => {
    const user = userEvent.setup();
    stubApi();
    renderActivate('/', activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await user.click(screen.getByRole('button', { name: 'Test: go back' }));

    expect(await screen.findByTestId('product-page')).toBeInTheDocument();
  });

  it('shows the form with an empty, editable code field when opened without a fragment (ONB-2)', async () => {
    const user = userEvent.setup();
    stubApi();

    renderActivate('/activate');

    expect(screen.getByRole('heading', { name: 'Activate your course' })).toBeInTheDocument();
    expect(codeField()).toHaveValue('');
    expect(firstNameField()).toHaveValue('');
    expect(usernameField()).toHaveValue('');
    expect(passwordField()).toHaveValue('');
    expect(passwordField()).toHaveAttribute('type', 'password');
    expect(repeatPasswordField()).toHaveValue('');
    expect(repeatPasswordField()).toHaveAttribute('type', 'password');
    expect(submitButton()).toBeEnabled();
    expect(address()).toBe('/activate');

    await user.type(codeField(), activationCode);
    expect(codeField()).toHaveValue(activationCode);
  });

  it('tells a student who already has an account to sign in and add the code there, with a plain link to /login (ADR 027)', async () => {
    const fetchMock = stubApi();

    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    // Before any submit the only "Sign in" link in the page body is the one in this sentence.
    const signIn = within(screen.getByRole('main')).getByRole('link', { name: 'Sign in' });
    expect(signIn).toHaveAttribute('href', '/login');
    expect(signIn.parentElement).toHaveTextContent(
      'Already have an account? Sign in, choose Add a course and paste this code.',
    );
    // The sentence is not part of the form: it is there before and after any attempt.
    expect(signInLinkInForm('query')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a required error under each field and sends no request when submitted empty', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderActivate('/activate');

    await user.click(submitButton());

    await waitFor(() => expect(codeField()).toHaveAttribute('aria-invalid', 'true'));
    expect(codeField()).toHaveAccessibleDescription(/Enter your activation code/);
    expect(firstNameField()).toHaveAttribute('aria-invalid', 'true');
    expect(firstNameField()).toHaveAccessibleDescription(/Enter your first name/);
    expect(usernameField()).toHaveAttribute('aria-invalid', 'true');
    expect(usernameField()).toHaveAccessibleDescription(/Enter a username/);
    expect(passwordField()).toHaveAttribute('aria-invalid', 'true');
    expect(passwordField()).toHaveAccessibleDescription(/Enter a password/);
    expect(repeatPasswordField()).toHaveAttribute('aria-invalid', 'true');
    expect(repeatPasswordField()).toHaveAccessibleDescription(/Repeat your password/);
    expect(activationRequests(fetchMock)).toHaveLength(0);
  });

  it('treats a first name of spaces only as missing and sends no request', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await fillForm(user, { firstName: '   ' });
    await user.click(submitButton());

    await waitFor(() => expect(firstNameField()).toHaveAttribute('aria-invalid', 'true'));
    expect(firstNameField()).toHaveAccessibleDescription(/Enter your first name/);
    expect(activationRequests(fetchMock)).toHaveLength(0);
  });

  it.each([
    ['a hyphen', 'sam-07'],
    ['a space inside', 'sam 07'],
    ['two characters', 'sa'],
    ['twenty-one characters', 'a'.repeat(21)],
  ])('shows the username rule and sends no request for a username with %s', async (_case, username) => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await fillForm(user, { username });
    await user.click(submitButton());

    await waitFor(() => expect(usernameField()).toHaveAttribute('aria-invalid', 'true'));
    expect(usernameField()).toHaveAccessibleDescription(/Use 3 to 20 letters, numbers or underscores/);
    expect(passwordField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(activationRequests(fetchMock)).toHaveLength(0);
  });

  it('shows "Use at least 8 characters" and sends no request for a 7-character password', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await fillForm(user, { password: 'seven77' });
    await user.click(submitButton());

    await waitFor(() => expect(passwordField()).toHaveAttribute('aria-invalid', 'true'));
    expect(passwordField()).toHaveAccessibleDescription(/Use at least 8 characters/);
    expect(usernameField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(activationRequests(fetchMock)).toHaveLength(0);
  });

  it('shows "The passwords do not match" and sends no request when the repeat differs', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await fillForm(user, { repeatPassword: `${fakePassword}-typo` });
    await user.click(submitButton());

    await waitFor(() => expect(repeatPasswordField()).toHaveAttribute('aria-invalid', 'true'));
    expect(repeatPasswordField()).toHaveAccessibleDescription(/The passwords do not match/);
    expect(passwordField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(activationRequests(fetchMock)).toHaveLength(0);
  });

  it('sends POST /api/activations with the code, trimmed first name, lower-cased username and the password as typed, and nothing else (ONB-3)', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    const spacedPassword = ` ${fakePassword} `;
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await fillForm(user, { firstName: '  Sam ', username: ' Sam_07 ', password: spacedPassword });
    await user.click(submitButton());

    await waitFor(() => expect(activationRequests(fetchMock)).toHaveLength(1));
    const [url, init] = activationRequests(fetchMock)[0];
    expect(url).toBe('/api/activations');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      code: activationCode,
      firstName: 'Sam',
      username: 'sam_07',
      password: spacedPassword,
    });
  });

  it('sends a code typed by hand trimmed but otherwise as typed', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    renderActivate('/activate');

    await fillForm(user, { code: ' abcde-fghjk-mnpqr ' });
    await user.click(submitButton());

    await waitFor(() => expect(activationRequests(fetchMock)).toHaveLength(1));
    const [, init] = activationRequests(fetchMock)[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      code: 'abcde-fghjk-mnpqr',
      firstName: 'Sam',
      username: 'sam_07',
      password: fakePassword,
    });
  });

  it('takes the student to /lms with a welcome by first name after a 201 (ONB-3, ONB-4)', async () => {
    const user = userEvent.setup();
    stubApi(created);
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /creat/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(activationCode);
  });

  it('shows "That username is taken" under the username, keeps the values and re-enables the button after 409 username_taken', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(refused(409, 'username_taken'));
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await fillForm(user);
    await user.click(submitButton());

    await waitFor(() =>
      expect(usernameField()).toHaveAccessibleDescription(/That username is taken\. Choose another\./),
    );
    expect(usernameField()).toHaveAttribute('aria-invalid', 'true');
    expect(codeField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(activationRequests(fetchMock)).toHaveLength(1);
    expectFormKeptItsValues();
    expect(submitButton()).toBeEnabled();
    expect(screen.queryByRole('heading', { name: /welcome/i })).not.toBeInTheDocument();
  });

  it('clears the "username is taken" error as soon as the username is edited', async () => {
    const user = userEvent.setup();
    stubApi(refused(409, 'username_taken'));
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));
    await fillForm(user);
    await user.click(submitButton());
    await waitFor(() => expect(usernameField()).toHaveAttribute('aria-invalid', 'true'));

    await user.type(usernameField(), '2');

    await waitFor(() => expect(usernameField()).not.toHaveAttribute('aria-invalid', 'true'));
    expect(screen.queryByText(/That username is taken/)).not.toBeInTheDocument();
  });

  it.each(['ABCDE-FGHJK-MNPQ', 'ABCDE-FGHJK-MNPQO', 'not a code'])(
    'shows the "not valid" error under the code field and sends no request for the malformed code %s',
    async (malformed) => {
      const user = userEvent.setup();
      const fetchMock = stubApi();
      renderActivate('/activate');
      await fillForm(user);
      await user.clear(codeField());
      await user.type(codeField(), malformed);
      await user.click(submitButton());

      await waitFor(() => expect(codeField()).toHaveAccessibleDescription(/This activation code is not valid/));
      expect(codeField()).toHaveAttribute('aria-invalid', 'true');
      expect(activationRequests(fetchMock)).toHaveLength(0);
    },
  );

  it('shows "This activation code is not valid" under the code field after 422 code_invalid', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(refused(422, 'code_invalid'));
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await fillForm(user);
    await user.click(submitButton());

    await waitFor(() =>
      expect(codeField()).toHaveAccessibleDescription(
        /This activation code is not valid\. Check it and try again\./,
      ),
    );
    expect(codeField()).toHaveAttribute('aria-invalid', 'true');
    expect(usernameField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(activationRequests(fetchMock)).toHaveLength(1);
    expectFormKeptItsValues();
    expect(submitButton()).toBeEnabled();
  });

  it('shows an alert and a "Sign in" link to /login after 409 code_used', async () => {
    const user = userEvent.setup();
    stubApi(refused(409, 'code_used'));
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('This code has already been used.');
    expect(signInLinkInForm('get')).toHaveAttribute('href', '/login');
    expect(usernameField()).not.toHaveAttribute('aria-invalid', 'true');
    expectFormKeptItsValues();
    expect(submitButton()).toBeEnabled();
    expect(screen.queryByRole('heading', { name: /welcome/i })).not.toBeInTheDocument();
  });

  it('shows "Check the details and try again." after a 400', async () => {
    const user = userEvent.setup();
    stubApi(refused(400));
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the details and try again.');
    expect(signInLinkInForm('query')).not.toBeInTheDocument();
    expectFormKeptItsValues();
    expect(submitButton()).toBeEnabled();
  });

  it.each<[string, ActivationReply]>([
    ['a 500 with a JSON body', refused(500)],
    ['a 502 with a non-JSON body', () => new Response('<html>Bad Gateway</html>', { status: 502 })],
    [
      'a network failure',
      () => {
        throw new TypeError('Failed to fetch');
      },
    ],
  ])('shows the generic alert, keeps the values and re-enables the button after %s', async (_case, reply) => {
    const user = userEvent.setup();
    const fetchMock = stubApi(reply);
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not create your account. Please try again.',
    );
    expect(activationRequests(fetchMock)).toHaveLength(1);
    expect(signInLinkInForm('query')).not.toBeInTheDocument();
    expectFormKeptItsValues();
    expect(submitButton()).toBeEnabled();
    expect(screen.queryByRole('heading', { name: /welcome/i })).not.toBeInTheDocument();
  });

  it('disables the button and reads "Creating account…" while the request is pending', async () => {
    const user = userEvent.setup();
    let respond: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      respond = resolve;
    });
    const fetchMock = stubApi(() => pending);
    renderActivate(activateLink);
    await waitFor(() => expect(address()).toBe('/activate'));

    await fillForm(user);
    await user.click(submitButton());

    await waitFor(() => expect(activationRequests(fetchMock)).toHaveLength(1));
    const button = screen.getByRole('button', { name: 'Creating account…' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(activationRequests(fetchMock)).toHaveLength(1);

    respond(json(sam, 201));
    expect(await screen.findByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument();
  });
});
