import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { RequireSession } from './RequireSession';
import { deferredReply, json, noContent, requestsTo, sam, stubApi, unauthorized } from './test/api';

function renderGuarded() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/lms']}>
        <Routes>
          <Route element={<RequireSession />}>
            <Route path="/lms" element={<p data-testid="child">Guarded content</p>} />
          </Route>
          <Route
            path="/login"
            element={
              <>
                <p data-testid="login-page">Login page</p>
                <Link to="/lms">Test: open the LMS</Link>
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('RequireSession', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('redirects to /login and renders no child content when GET /api/session returns 401 (LMS-1)', async () => {
    const fetchMock = stubApi({ 'GET /api/session': unauthorized });

    renderGuarded();

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, 'GET', '/api/session')).toHaveLength(1);
  });

  it('renders the child route and the LMS navigation with "Sign out" when the session is valid', async () => {
    stubApi({ 'GET /api/session': () => json(sam) });

    renderGuarded();

    expect(await screen.findByTestId('child')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My courses' })).toHaveAttribute('href', '/lms');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('has an "Add a course" link to /lms/add-course in the header navigation, next to "My courses" (M13)', async () => {
    stubApi({ 'GET /api/session': () => json(sam) });

    renderGuarded();

    expect(await screen.findByTestId('child')).toBeInTheDocument();
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.getByRole('link', { name: 'My courses' })).toHaveAttribute('href', '/lms');
    expect(nav.getByRole('link', { name: 'Add a course' })).toHaveAttribute('href', '/lms/add-course');
  });

  it('shows "Loading…" and not the child while the session answer is pending', async () => {
    const session = deferredReply();
    stubApi({ 'GET /api/session': session.reply });

    renderGuarded();

    expect(await screen.findByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();

    session.respond(json(sam));
    expect(await screen.findByTestId('child')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('"Sign out" sends DELETE /api/session, shows the login route, and a later visit to /lms asks for the session again (M20)', async () => {
    const user = userEvent.setup();
    let signedIn = true;
    const fetchMock = stubApi({
      'GET /api/session': () => (signedIn ? json(sam) : unauthorized()),
      'DELETE /api/session': () => {
        signedIn = false;
        return noContent();
      },
    });
    const queryClient = renderGuarded();
    const signOutButton = await screen.findByRole('button', { name: 'Sign out' });
    // What a lesson page would have left in the cache.
    queryClient.setQueryData(['lms', sam.id, 'lesson', 'course', 'lesson'], { body: 'Lesson text' });

    await user.click(signOutButton);

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    // Nothing of this student stays in memory for the next person at this browser.
    expect(queryClient.getQueryCache().findAll({ queryKey: ['lms'] })).toHaveLength(0);
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, 'DELETE', '/api/session')).toHaveLength(1);

    // The cached "signed in" answer must be gone: going back to /lms asks the API again.
    const sessionRequestsBefore = requestsTo(fetchMock, 'GET', '/api/session').length;
    await user.click(screen.getByRole('link', { name: 'Test: open the LMS' }));

    await waitFor(() =>
      expect(requestsTo(fetchMock, 'GET', '/api/session').length).toBeGreaterThan(sessionRequestsBefore),
    );
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });
});
