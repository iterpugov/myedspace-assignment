import type { StudentResponse } from '@mes/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { LmsPage } from './LmsPage';

const sam: StudentResponse = {
  id: '5f4e3d2c-1b0a-4f9e-8d7c-6b5a4f3e2d06',
  username: 'sam_07',
  firstName: 'Sam',
};

type SessionReply = () => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** GET /api/session answers as the test says; nothing else is expected from this page. */
function stubApi(sessionReply: SessionReply) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (input === '/api/session' && method === 'GET') {
      return sessionReply();
    }
    throw new Error(`Unexpected request: ${method} ${String(input)}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderLms() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/lms']}>
        <Routes>
          <Route path="/lms" element={<LmsPage />} />
          <Route path="/login" element={<p data-testid="login-page">Login page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LmsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('welcomes the signed-in student by first name when GET /api/session returns 200 (ONB-4)', async () => {
    const fetchMock = stubApi(() => json(sam));

    renderLms();

    expect(await screen.findByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/session');
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('shows "Loading…" and no welcome until the session answer arrives', async () => {
    let respond: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      respond = resolve;
    });
    stubApi(() => pending);

    renderLms();

    expect(await screen.findByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /welcome/i })).not.toBeInTheDocument();

    respond(json(sam));
    expect(await screen.findByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('redirects to /login and shows no welcome when GET /api/session returns 401', async () => {
    stubApi(() => json({ statusCode: 401, message: 'Unauthorized' }, 401));

    renderLms();

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /welcome/i })).not.toBeInTheDocument();
  });
});
