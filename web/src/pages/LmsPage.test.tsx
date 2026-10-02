import type { EnrolledCourseResponse } from '@mes/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { RequireSession } from '../RequireSession';
import { json, requestsTo, sam, stubApi, unauthorized, type Reply } from '../test/api';
import { LmsPage } from './LmsPage';

const mathsId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c01';
const fractionsId = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d01';
const ratiosId = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d02';

const maths: EnrolledCourseResponse = {
  courseId: mathsId,
  subject: 'Maths',
  year: 7,
  lessons: [
    { id: fractionsId, position: 1, title: 'Fractions', summary: 'Parts of a whole.' },
    { id: ratiosId, position: 2, title: 'Ratios', summary: 'Comparing quantities.' },
  ],
};

/** The session is valid; GET /api/lms/courses answers as the test says. */
function stubLmsApi(coursesReply: Reply) {
  return stubApi({
    'GET /api/session': () => json(sam),
    'GET /api/lms/courses': coursesReply,
  });
}

/** The page is mounted the way the app mounts it: inside the session guard. */
function renderLms() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/lms']}>
        <Routes>
          <Route element={<RequireSession />}>
            <Route path="/lms" element={<LmsPage />} />
          </Route>
          <Route path="/login" element={<p data-testid="login-page">Login page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LmsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('welcomes the student and shows a "Maths · Year 7" card whose lessons link to their lesson pages (LMS-2, LMS-3)', async () => {
    const fetchMock = stubLmsApi(() => json([maths]));

    renderLms();

    expect(await screen.findByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Maths · Year 7' })).toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('link', { name: /Fractions/ })).toHaveAttribute(
      'href',
      `/lms/courses/${mathsId}/lessons/${fractionsId}`,
    );
    expect(main.getByRole('link', { name: /Ratios/ })).toHaveAttribute(
      'href',
      `/lms/courses/${mathsId}/lessons/${ratiosId}`,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, 'GET', '/api/lms/courses')).toHaveLength(1);
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('shows the "no courses yet" notice and no error for an empty course list', async () => {
    stubLmsApi(() => json([]));

    renderLms();

    expect(
      await screen.findByText('You have no courses yet. Ask your parent for an activation link.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error notice when the courses request fails', async () => {
    stubLmsApi(() => json({ statusCode: 500, message: 'Internal server error' }, 500));

    renderLms();

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your courses. Please try again.');
    expect(screen.queryByText(/You have no courses yet/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('ends on /login when the courses request returns 401 because the session expired (M19)', async () => {
    // Like the real API: once the token has expired, the session endpoint says 401 as well.
    let expired = false;
    stubApi({
      'GET /api/session': () => (expired ? unauthorized() : json(sam)),
      'GET /api/lms/courses': () => {
        expired = true;
        return unauthorized();
      },
    });

    renderLms();

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /welcome/i })).not.toBeInTheDocument();
  });
});
