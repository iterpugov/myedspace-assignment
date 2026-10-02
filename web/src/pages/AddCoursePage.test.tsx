import type { EnrolledCourseResponse, RedeemCodeResponse, RedemptionFailureReason } from '@mes/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { RequireSession } from '../RequireSession';
import { deferredReply, json, requestsTo, sam, stubApi, unauthorized, type Reply } from '../test/api';
import { AddCoursePage } from './AddCoursePage';
import { LmsPage } from './LmsPage';

/** Not a real code: a made-up value in the code alphabet, used only to fill the form in tests. */
const activationCode = 'ABCDE-FGHJK-MNPQR';

const CODE_INVALID = 'This activation code is not valid. Check it and try again.';
const DUPLICATE =
  'You already have this course for this year. This purchase is a duplicate: ask your parent to contact us. The code has not been used.';
/** Shown when the code came with the student from the activation link (ADR 029). */
const CARRIED_NOTICE = /^The code from your link is filled in\. Press Add course to add it to Sam['’]s account\.$/;
const WRONG_ACCOUNT = /Not Sam\? Sign out, then open your link again\./;

const mathsId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c01';
const englishId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c02';

const maths: EnrolledCourseResponse = {
  courseId: mathsId,
  subject: 'Maths',
  year: 7,
  lessons: [{ id: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d01', position: 1, title: 'Fractions', summary: 'Parts of a whole.' }],
};

const english: EnrolledCourseResponse = {
  courseId: englishId,
  subject: 'English',
  year: 7,
  lessons: [{ id: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d11', position: 1, title: 'Poetry', summary: 'Rhythm and rhyme.' }],
};

const added: RedeemCodeResponse = { courseId: englishId, year: 7 };

const refused =
  (status: number, reason?: RedemptionFailureReason): Reply =>
  () =>
    json({ statusCode: status, message: 'Request failed', ...(reason ? { reason } : {}) }, status);

/**
 * The session is valid and POST /api/redemptions answers as the test says. Like the real
 * API, GET /api/lms/courses lists Maths until a redemption has answered 200, then English too.
 */
function stubAddCourseApi(redemptionReply: Reply = () => json(added)) {
  let redeemed = false;
  return stubApi({
    'GET /api/session': () => json(sam),
    'GET /api/lms/courses': () => json(redeemed ? [english, maths] : [maths]),
    'POST /api/redemptions': async (init) => {
      const response = await redemptionReply(init);
      if (response.status === 200) redeemed = true;
      return response;
    },
  });
}

const redemptionRequests = (fetchMock: ReturnType<typeof stubApi>) =>
  requestsTo(fetchMock, 'POST', '/api/redemptions');

/** Lets a test step back in history, to see which entry the page left behind. */
function BackProbe() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Test: go back
    </button>
  );
}

/** Stands in for the sign-in page, and shows the router state it was opened with. */
function LoginProbe() {
  const location = useLocation();
  return (
    <>
      <p data-testid="login-page">Login page</p>
      <output data-testid="login-state">{JSON.stringify(location.state)}</output>
    </>
  );
}

/**
 * The page is mounted the way the app mounts it: inside the session guard, next to the
 * dashboard. `state` is the router state of the entry, as the activation page leaves it.
 */
function renderAt(path: '/lms' | '/lms/add-course', state?: unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[state === undefined ? path : { pathname: path, state }]}>
        <Routes>
          <Route element={<RequireSession />}>
            <Route path="/lms" element={<LmsPage />} />
            <Route path="/lms/add-course" element={<AddCoursePage />} />
          </Route>
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
        <BackProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const pageHeading = () => screen.findByRole('heading', { level: 1, name: /^Add a course to Sam['’]s account$/ });
const queryPageHeading = () => screen.queryByRole('heading', { name: /^Add a course to / });
const codeField = () => screen.getByRole('textbox', { name: 'Activation code' });
const submitButton = () => screen.getByRole('button', { name: 'Add course' });

/** Opens the add-course page and waits until its form is there. */
async function openAddCourse(state?: unknown) {
  renderAt('/lms/add-course', state);
  await pageHeading();
}

describe('AddCoursePage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('names the signed-in student in the heading and starts with an empty code field (M19)', async () => {
    const fetchMock = stubAddCourseApi();

    renderAt('/lms/add-course');

    expect(await pageHeading()).toBeInTheDocument();
    expect(codeField()).toHaveValue('');
    expect(codeField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(submitButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // Nothing was carried from a link, so nothing says so.
    expect(screen.queryByText(/The code from your link/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sign out, then open your link again/)).not.toBeInTheDocument();
    expect(redemptionRequests(fetchMock)).toHaveLength(0);
  });

  describe('opened with a code carried in router state (ADR 029)', () => {
    it('fills the field with the code, says so in a live notice that names the account, and sends no redemption until the student submits', async () => {
      const fetchMock = stubAddCourseApi();

      await openAddCourse({ activationCode });

      expect(codeField()).toHaveValue(activationCode);
      expect(codeField()).not.toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('status')).toHaveTextContent(CARRIED_NOTICE);
      expect(screen.getByText(WRONG_ACCOUNT)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(submitButton()).toBeEnabled();
      // Only prefilled: the course is added when the student presses the button.
      expect(redemptionRequests(fetchMock)).toHaveLength(0);
    });

    it('[S] takes the code out of the history entry once it is in the field: coming back to the page finds an empty form', async () => {
      const user = userEvent.setup();
      const fetchMock = stubAddCourseApi();
      await openAddCourse({ activationCode });
      expect(codeField()).toHaveValue(activationCode);

      // Leaving by a link pushes a new entry; the add-course entry stays in history.
      await user.click(screen.getByRole('link', { name: '← Back to my courses' }));
      expect(await screen.findByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Test: go back' }));

      expect(await pageHeading()).toBeInTheDocument();
      expect(codeField()).toHaveValue('');
      expect(screen.queryByText(/The code from your link/)).not.toBeInTheDocument();
      expect(document.body).not.toHaveTextContent(activationCode);
      expect(redemptionRequests(fetchMock)).toHaveLength(0);
    });

    it('keeps the prefilled field editable', async () => {
      const user = userEvent.setup();
      const fetchMock = stubAddCourseApi();
      await openAddCourse({ activationCode });
      expect(codeField()).toHaveValue(activationCode);

      await user.clear(codeField());
      await user.type(codeField(), 'ZZZZZ-ZZZZZ-ZZZZZ');

      expect(codeField()).toHaveValue('ZZZZZ-ZZZZZ-ZZZZZ');
      expect(redemptionRequests(fetchMock)).toHaveLength(0);
    });

    it('submitting the prefilled code sends exactly { code } and, after a 200, lands on the dashboard with the new course', async () => {
      const user = userEvent.setup();
      const fetchMock = stubAddCourseApi();
      await openAddCourse({ activationCode });
      expect(codeField()).toHaveValue(activationCode);

      await user.click(submitButton());

      expect(await screen.findByRole('heading', { name: 'English · Year 7' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument();
      expect(queryPageHeading()).not.toBeInTheDocument();
      expect(redemptionRequests(fetchMock)).toHaveLength(1);
      const [url, init] = redemptionRequests(fetchMock)[0];
      expect(url).toBe('/api/redemptions');
      expect(JSON.parse(String(init?.body))).toEqual({ code: activationCode });
      // The code is a secret (ADR 020): nothing on the dashboard repeats it.
      expect(document.body).not.toHaveTextContent(activationCode);
    });

    it.each<[string, unknown]>([
      ['a code that is a number', { activationCode: 123456789012345 }],
      ['a code that is an array', { activationCode: [activationCode] }],
      ['a code under another key', { code: activationCode }],
      ['a bare string', activationCode],
      ['a code longer than 64 characters', { activationCode: 'A'.repeat(65) }],
      ['an empty code', { activationCode: '' }],
    ])('ignores state holding %s: the field is empty and nothing mentions a link', async (_case, state) => {
      const fetchMock = stubAddCourseApi();

      await openAddCourse(state);

      expect(codeField()).toHaveValue('');
      expect(screen.queryByText(/The code from your link/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Sign out, then open your link again/)).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(redemptionRequests(fetchMock)).toHaveLength(0);
    });

    it('[S] with no session ends on /login, and the sign-in page receives no state: the code is not carried through sign-in', async () => {
      const fetchMock = stubApi({ 'GET /api/session': unauthorized });

      renderAt('/lms/add-course', { activationCode });

      expect(await screen.findByTestId('login-page')).toBeInTheDocument();
      expect(screen.getByTestId('login-state')).toHaveTextContent(/^null$/);
      expect(document.body).not.toHaveTextContent(activationCode);
      expect(queryPageHeading()).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Activation code' })).not.toBeInTheDocument();
      expect(redemptionRequests(fetchMock)).toHaveLength(0);
    });

    it('shows the duplicate notice and keeps the prefilled code after 409 course_already_owned', async () => {
      const user = userEvent.setup();
      const fetchMock = stubAddCourseApi(refused(409, 'course_already_owned'));
      await openAddCourse({ activationCode });

      await user.click(submitButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(DUPLICATE);
      expect(codeField()).toHaveValue(activationCode);
      expect(redemptionRequests(fetchMock)).toHaveLength(1);
      expect(queryPageHeading()).toBeInTheDocument();
    });
  });

  it('has a "← Back to my courses" link to /lms', async () => {
    stubAddCourseApi();

    await openAddCourse();

    const main = within(screen.getByRole('main'));
    expect(main.getByRole('link', { name: '← Back to my courses' })).toHaveAttribute('href', '/lms');
  });

  it.each([
    ['empty', ''],
    ['spaces only', '   '],
  ])('shows "Enter your activation code" under the field and sends no request when the code is %s', async (_case, typed) => {
    const user = userEvent.setup();
    const fetchMock = stubAddCourseApi();
    await openAddCourse();

    if (typed) await user.type(codeField(), typed);
    await user.click(submitButton());

    await waitFor(() => expect(codeField()).toHaveAttribute('aria-invalid', 'true'));
    expect(codeField()).toHaveAccessibleDescription(/Enter your activation code/);
    expect(redemptionRequests(fetchMock)).toHaveLength(0);
  });

  it.each(['ABCDE-FGHJK-MNPQ', 'ABCDE-FGHJK-MNPQO', 'not a code'])(
    'shows the "not valid" error under the field and sends no request for the malformed code %s',
    async (malformed) => {
      const user = userEvent.setup();
      const fetchMock = stubAddCourseApi();
      await openAddCourse();

      await user.type(codeField(), malformed);
      await user.click(submitButton());

      await waitFor(() => expect(codeField()).toHaveAttribute('aria-invalid', 'true'));
      expect(codeField()).toHaveAccessibleDescription(
        /This activation code is not valid\. Check it and try again\./,
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(redemptionRequests(fetchMock)).toHaveLength(0);
    },
  );

  it('sends POST /api/redemptions with exactly { code }, trimmed but otherwise as typed', async () => {
    const user = userEvent.setup();
    const fetchMock = stubAddCourseApi();
    await openAddCourse();

    await user.type(codeField(), ' abcde-fghjk-mnpqr ');
    await user.click(submitButton());

    await waitFor(() => expect(redemptionRequests(fetchMock)).toHaveLength(1));
    const [url, init] = redemptionRequests(fetchMock)[0];
    expect(url).toBe('/api/redemptions');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    // Exactly the code: the student is the session's, never named by the page.
    expect(JSON.parse(String(init?.body))).toEqual({ code: 'abcde-fghjk-mnpqr' });
  });

  it('after a 200 returns to the dashboard, asks for the courses again and shows the new course; Back does not reopen the form (M15)', async () => {
    const user = userEvent.setup();
    const fetchMock = stubAddCourseApi();
    renderAt('/lms');
    expect(await screen.findByRole('heading', { name: 'Maths · Year 7' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'English · Year 7' })).not.toBeInTheDocument();
    const courseRequestsBefore = requestsTo(fetchMock, 'GET', '/api/lms/courses').length;

    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Add a course' }));
    await pageHeading();
    await user.type(codeField(), activationCode);
    await user.click(submitButton());

    expect(await screen.findByRole('heading', { name: 'English · Year 7' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Maths · Year 7' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument();
    expect(queryPageHeading()).not.toBeInTheDocument();
    expect(redemptionRequests(fetchMock)).toHaveLength(1);
    expect(requestsTo(fetchMock, 'GET', '/api/lms/courses').length).toBeGreaterThan(courseRequestsBefore);
    // The code is a secret (ADR 020): nothing on the dashboard repeats it.
    expect(document.body).not.toHaveTextContent(activationCode);

    // The form's history entry was replaced, so Back lands on the dashboard, not on a form.
    await user.click(screen.getByRole('button', { name: 'Test: go back' }));
    expect(await screen.findByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument();
    expect(queryPageHeading()).not.toBeInTheDocument();
  });

  it('shows the duplicate notice naming the parent and keeps the code in the field after 409 course_already_owned (M16)', async () => {
    const user = userEvent.setup();
    const fetchMock = stubAddCourseApi(refused(409, 'course_already_owned'));
    await openAddCourse();

    await user.type(codeField(), activationCode);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(DUPLICATE);
    expect(codeField()).toHaveValue(activationCode);
    expect(codeField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(submitButton()).toBeEnabled();
    expect(queryPageHeading()).toBeInTheDocument();
    expect(redemptionRequests(fetchMock)).toHaveLength(1);
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('shows "This code has already been used." after 409 code_used (M16)', async () => {
    const user = userEvent.setup();
    stubAddCourseApi(refused(409, 'code_used'));
    await openAddCourse();

    await user.type(codeField(), activationCode);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('This code has already been used.');
    expect(screen.getByRole('alert')).not.toHaveTextContent(/You already have this course/);
    expect(codeField()).toHaveValue(activationCode);
    expect(codeField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(submitButton()).toBeEnabled();
    expect(queryPageHeading()).toBeInTheDocument();
  });

  it('shows the "not valid" error under the field, and no separate notice, after 422 code_invalid (M16)', async () => {
    const user = userEvent.setup();
    const fetchMock = stubAddCourseApi(refused(422, 'code_invalid'));
    await openAddCourse();

    await user.type(codeField(), activationCode);
    await user.click(submitButton());

    await waitFor(() => expect(codeField()).toHaveAccessibleDescription(CODE_INVALID));
    expect(codeField()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(codeField()).toHaveValue(activationCode);
    expect(submitButton()).toBeEnabled();
    expect(redemptionRequests(fetchMock)).toHaveLength(1);
    expect(queryPageHeading()).toBeInTheDocument();
  });

  it.each<[string, Reply]>([
    ['a 500 with a JSON body', refused(500)],
    ['a 502 with a non-JSON body', () => new Response('<html>Bad Gateway</html>', { status: 502 })],
    [
      'a network failure',
      () => {
        throw new TypeError('Failed to fetch');
      },
    ],
  ])('shows the generic notice, keeps the code and re-enables the button after %s', async (_case, reply) => {
    const user = userEvent.setup();
    const fetchMock = stubAddCourseApi(reply);
    await openAddCourse();

    await user.type(codeField(), activationCode);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(codeField()).toHaveValue(activationCode);
    expect(codeField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(submitButton()).toBeEnabled();
    expect(redemptionRequests(fetchMock)).toHaveLength(1);
    expect(queryPageHeading()).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('[S] ends on /login when the redemption returns 401 because the session expired (M17)', async () => {
    const user = userEvent.setup();
    // Like the real API: once the token has expired, the session endpoint says 401 as well.
    let expired = false;
    const fetchMock = stubApi({
      'GET /api/session': () => (expired ? unauthorized() : json(sam)),
      'POST /api/redemptions': () => {
        expired = true;
        return unauthorized();
      },
    });
    await openAddCourse();

    await user.type(codeField(), activationCode);
    await user.click(submitButton());

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    expect(queryPageHeading()).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Activation code' })).not.toBeInTheDocument();
    expect(redemptionRequests(fetchMock)).toHaveLength(1);
  });

  it('[S] redirects to /login, renders no form and sends no redemption when there is no session', async () => {
    const fetchMock = stubApi({ 'GET /api/session': unauthorized });

    renderAt('/lms/add-course');

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    expect(queryPageHeading()).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Activation code' })).not.toBeInTheDocument();
    expect(redemptionRequests(fetchMock)).toHaveLength(0);
  });

  it('disables the button while the request is pending, so a second click sends nothing', async () => {
    const user = userEvent.setup();
    const redemption = deferredReply();
    const fetchMock = stubAddCourseApi(redemption.reply);
    await openAddCourse();

    await user.type(codeField(), activationCode);
    await user.click(submitButton());

    await waitFor(() => expect(redemptionRequests(fetchMock)).toHaveLength(1));
    const button = screen.getByRole('button', { name: /^(Add course|Adding…)$/ });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(redemptionRequests(fetchMock)).toHaveLength(1);

    redemption.respond(json(added));
    expect(await screen.findByRole('heading', { name: 'English · Year 7' })).toBeInTheDocument();
  });
});
