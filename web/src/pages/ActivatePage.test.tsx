import type { ActivationFailureReason, StudentResponse } from '@mes/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { SESSION_KEY } from '../api/session';
import { RequireSession } from '../RequireSession';
import { deferredReply } from '../test/api';
import { ActivatePage } from './ActivatePage';
import { AddCoursePage } from './AddCoursePage';
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

const unauthorized = () => json({ statusCode: 401, message: 'Unauthorized' }, 401);

interface SessionStub {
  /** A student is signed in before the page opens. */
  signedIn?: boolean;
  /** The answer to the first GET /api/session only; later ones behave like the real API. */
  firstSessionReply?: ActivationReply;
}

/**
 * POST /api/activations answers as the test says. GET /api/session behaves like the real
 * API: 401 until an activation has succeeded (or from the start, if the test says a student
 * is signed in), then the student. GET /api/lms/courses is what the dashboard asks for once
 * the student lands on /lms; it answers with no courses. Nothing else is expected: a
 * redemption request rejects.
 */
function stubApi(activationReply: ActivationReply = created, session: SessionStub = {}) {
  let signedIn = session.signedIn ?? false;
  let firstSessionReply = session.firstSessionReply;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (input === '/api/activations' && method === 'POST') {
      const response = await activationReply();
      if (response.status === 201) signedIn = true;
      return response;
    }
    if (input === '/api/session' && method === 'GET') {
      if (firstSessionReply) {
        const reply = firstSessionReply;
        firstSessionReply = undefined;
        return reply();
      }
      return signedIn ? json(sam) : unauthorized();
    }
    if (input === '/api/lms/courses' && method === 'GET') {
      return signedIn ? json([]) : unauthorized();
    }
    throw new Error(`Unexpected request: ${method} ${String(input)}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

type ApiStub = ReturnType<typeof stubApi>;

const requestsTo = (fetchMock: ApiStub, path: string) => fetchMock.mock.calls.filter(([input]) => input === path);
const activationRequests = (fetchMock: ApiStub) => requestsTo(fetchMock, '/api/activations');
const redemptionRequests = (fetchMock: ApiStub) => requestsTo(fetchMock, '/api/redemptions');
const sessionRequests = (fetchMock: ApiStub) => requestsTo(fetchMock, '/api/session');

/** Shows the router's current address on every route, and lets a test step back in history. */
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

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/**
 * The routes the app has around the activation page. /lms/add-course is there so that a
 * redirect to it, wanted or not, is visible.
 */
function renderActivateWith(queryClient: QueryClient, ...initialEntries: string[]) {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}>
        <Routes>
          <Route path="/" element={<p data-testid="product-page">Product page</p>} />
          <Route path="/activate" element={<ActivatePage />} />
          <Route element={<RequireSession />}>
            <Route path="/lms" element={<LmsPage />} />
            <Route path="/lms/add-course" element={<AddCoursePage />} />
          </Route>
          <Route path="/login" element={<p data-testid="login-page">Login page</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderActivate(...initialEntries: string[]) {
  renderActivateWith(newQueryClient(), ...initialEntries);
}

const address = () => screen.getByTestId('location').textContent;
const codeField = () => screen.getByRole('textbox', { name: 'Activation code' });
const queryFormHeading = () => screen.queryByRole('heading', { name: 'Activate your course' });
const addCourseHeading = () => screen.findByRole('heading', { level: 1, name: /^Add a course to Sam['’]s account$/ });
const queryAddCourseHeading = () => screen.queryByRole('heading', { name: /^Add a course to / });
const firstNameField = () => screen.getByRole('textbox', { name: 'First name' });
const usernameField = () => screen.getByRole('textbox', { name: 'Username' });
// Password inputs have no textbox role, so they are found by their label.
const passwordField = () => screen.getByLabelText('Password');
const repeatPasswordField = () => screen.getByLabelText('Repeat password');
const submitButton = () => screen.getByRole('button', { name: 'Create account' });

/**
 * The onboarding form appears only once the session request has been answered (ADR 029);
 * by then the fragment is gone from the address.
 */
async function formShown() {
  await screen.findByRole('heading', { name: 'Activate your course' });
  await waitFor(() => expect(address()).toBe('/activate'));
}

/** Opens the activation page without a session and waits until its form is there. */
async function openForm(...initialEntries: string[]) {
  renderActivate(...initialEntries);
  await formShown();
}

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

    await formShown();
    expect(address()).toBe('/activate');
    expect(codeField()).toHaveValue(activationCode);
    expect(activationRequests(fetchMock)).toHaveLength(0);
  });

  it('replaces the history entry, so Back does not return to an address holding the code (ADR 020)', async () => {
    const user = userEvent.setup();
    stubApi();
    await openForm('/', activateLink);

    await user.click(screen.getByRole('button', { name: 'Test: go back' }));

    expect(await screen.findByTestId('product-page')).toBeInTheDocument();
  });

  it('shows the form with an empty, editable code field when opened without a fragment (ONB-2)', async () => {
    const user = userEvent.setup();
    stubApi();

    await openForm('/activate');

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

    await openForm(activateLink);

    // Before any submit the only "Sign in" link in the page body is the one in this sentence.
    const signIn = within(screen.getByRole('main')).getByRole('link', { name: 'Sign in' });
    expect(signIn).toHaveAttribute('href', '/login');
    expect(signIn.parentElement).toHaveTextContent(
      'Already have an account? Sign in, choose Add a course and paste this code.',
    );
    // The sentence is not part of the form: it is there before and after any attempt.
    expect(signInLinkInForm('query')).not.toBeInTheDocument();
    expect(activationRequests(fetchMock)).toHaveLength(0);
  });

  it('shows a required error under each field and sends no request when submitted empty', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi();
    await openForm('/activate');

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
    await openForm(activateLink);

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
    await openForm(activateLink);

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
    await openForm(activateLink);

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
    await openForm(activateLink);

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
    await openForm(activateLink);

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
    await openForm('/activate');

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

  it('takes the student to /lms, not to /lms/add-course, with a welcome by first name after a 201 (ONB-3, ONB-4, ADR 029)', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(created);
    await openForm(activateLink);

    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument();
    // The page has just put a student into the session cache; that must not send the
    // student to "Add a course" with the code they have used.
    expect(address()).toBe('/lms');
    expect(queryAddCourseHeading()).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Activation code' })).not.toBeInTheDocument();
    expect(redemptionRequests(fetchMock)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /creat/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(activationCode);
  });

  it('shows "That username is taken" under the username, keeps the values and re-enables the button after 409 username_taken', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(refused(409, 'username_taken'));
    await openForm(activateLink);

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
    await openForm(activateLink);
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
      await openForm('/activate');
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
    await openForm(activateLink);

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
    await openForm(activateLink);

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
    await openForm(activateLink);

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
    await openForm(activateLink);

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
    await openForm(activateLink);

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

  describe('the session decides what the link opens (ADR 029)', () => {
    it('asks for the session once before showing the form to a visitor who is not signed in', async () => {
      const fetchMock = stubApi();

      await openForm(activateLink);

      expect(sessionRequests(fetchMock)).toHaveLength(1);
      expect(codeField()).toHaveValue(activationCode);
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });

    it('shows "Loading…" and no form while the session request is pending, with the fragment already removed; a 401 then shows the form with the code', async () => {
      const session = deferredReply();
      const fetchMock = stubApi(created, { firstSessionReply: session.reply });

      renderActivate(activateLink);

      await waitFor(() => expect(address()).toBe('/activate'));
      await waitFor(() => expect(sessionRequests(fetchMock)).toHaveLength(1));
      expect(screen.getByText('Loading…')).toBeInTheDocument();
      expect(queryFormHeading()).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Activation code' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
      // The code is nowhere on the page while nobody knows who is looking at it.
      expect(document.body).not.toHaveTextContent(activationCode);

      session.respond(unauthorized());

      await formShown();
      expect(codeField()).toHaveValue(activationCode);
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
      expect(queryAddCourseHeading()).not.toBeInTheDocument();
    });

    it('[S] with a session, the link ends on /lms/add-course with the code in the field, and nothing is redeemed or activated', async () => {
      const fetchMock = stubApi(created, { signedIn: true });

      renderActivate(activateLink);

      expect(await addCourseHeading()).toBeInTheDocument();
      expect(codeField()).toHaveValue(activationCode);
      expect(screen.getByRole('button', { name: 'Add course' })).toBeEnabled();
      expect(queryFormHeading()).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
      // Only prefilled: the student has not pressed anything.
      expect(redemptionRequests(fetchMock)).toHaveLength(0);
      expect(activationRequests(fetchMock)).toHaveLength(0);
    });

    it('[S] after the redirect the address has no query and no fragment, and Back does not return to /activate (ADR 020)', async () => {
      const user = userEvent.setup();
      stubApi(created, { signedIn: true });

      renderActivate('/', activateLink);

      expect(await addCourseHeading()).toBeInTheDocument();
      // Path, search and hash together: the code travelled in router state, not in the address.
      expect(address()).toBe('/lms/add-course');

      await user.click(screen.getByRole('button', { name: 'Test: go back' }));

      // The /activate entry was replaced, so Back lands on the page before the link.
      expect(await screen.findByTestId('product-page')).toBeInTheDocument();
      expect(address()).toBe('/');
      expect(queryFormHeading()).not.toBeInTheDocument();
    });

    it('with a session and no code in the link, shows the onboarding form with an empty code field', async () => {
      const fetchMock = stubApi(created, { signedIn: true });

      renderActivate('/activate');

      await formShown();
      expect(sessionRequests(fetchMock)).toHaveLength(1);
      expect(codeField()).toHaveValue('');
      expect(submitButton()).toBeEnabled();
      expect(queryAddCourseHeading()).not.toBeInTheDocument();
    });

    it('shows the onboarding form with the code filled in when the session request fails with a 500, without asking again', async () => {
      const fetchMock = stubApi(created, { firstSessionReply: refused(500) });

      // The default client retries a failed query; the page itself must not (retry: false).
      renderActivateWith(new QueryClient(), activateLink);

      await formShown();
      expect(sessionRequests(fetchMock)).toHaveLength(1);
      expect(codeField()).toHaveValue(activationCode);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(queryAddCourseHeading()).not.toBeInTheDocument();
    });

    it('stays on the form when the session becomes a student while the form is shown: the choice is made once', async () => {
      const user = userEvent.setup();
      const queryClient = newQueryClient();
      const fetchMock = stubApi();
      renderActivateWith(queryClient, activateLink);
      await formShown();
      await user.type(firstNameField(), 'Sam');

      // What a successful onboarding on this page, or a sign-in in another tab, does to the cache.
      await act(async () => {
        queryClient.setQueryData(SESSION_KEY, sam);
      });

      expect(queryClient.getQueryData(SESSION_KEY)).toEqual(sam);
      expect(address()).toBe('/activate');
      expect(queryFormHeading()).toBeInTheDocument();
      expect(codeField()).toHaveValue(activationCode);
      expect(firstNameField()).toHaveValue('Sam');
      expect(queryAddCourseHeading()).not.toBeInTheDocument();
      expect(redemptionRequests(fetchMock)).toHaveLength(0);
    });

    it('does not decide on a signed-out answer left in the cache: it waits for the API, which says signed in', async () => {
      const queryClient = newQueryClient();
      // What an earlier page of this SPA left behind before the student signed in elsewhere.
      queryClient.setQueryData(SESSION_KEY, null);
      const fetchMock = stubApi(created, { signedIn: true });

      renderActivateWith(queryClient, '/', activateLink);

      expect(await addCourseHeading()).toBeInTheDocument();
      expect(codeField()).toHaveValue(activationCode);
      expect(address()).toBe('/lms/add-course');
      expect(queryFormHeading()).not.toBeInTheDocument();
      expect(redemptionRequests(fetchMock)).toHaveLength(0);
    });

    it('with the session already in the query cache, goes to /lms/add-course once and stays there', async () => {
      const user = userEvent.setup();
      const queryClient = newQueryClient();
      queryClient.setQueryData(SESSION_KEY, sam);
      const fetchMock = stubApi(created, { signedIn: true });

      renderActivateWith(queryClient, '/', activateLink);

      expect(await addCourseHeading()).toBeInTheDocument();
      expect(codeField()).toHaveValue(activationCode);
      // The cached session is refreshed in the background; that changes nothing.
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(address()).toBe('/lms/add-course');
      expect(queryAddCourseHeading()).toBeInTheDocument();
      expect(codeField()).toHaveValue(activationCode);
      expect(queryFormHeading()).not.toBeInTheDocument();
      expect(redemptionRequests(fetchMock)).toHaveLength(0);
      expect(activationRequests(fetchMock)).toHaveLength(0);

      // One navigation that replaced the /activate entry: Back is the page before the link.
      await user.click(screen.getByRole('button', { name: 'Test: go back' }));
      expect(await screen.findByTestId('product-page')).toBeInTheDocument();
    });
  });
});
