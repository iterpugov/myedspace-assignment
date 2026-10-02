import type { LessonResponse } from '@mes/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { RequireSession } from '../RequireSession';
import { json, requestsTo, sam, stubApi, unauthorized, type Reply } from '../test/api';
import { LessonPage } from './LessonPage';

const mathsId = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c01';
const ratiosId = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d02';
const lessonPath = `/lms/courses/${mathsId}/lessons/${ratiosId}`;
const lessonApiPath = `/api${lessonPath}`;

const firstParagraph = 'A ratio compares two quantities.';
const secondParagraph = 'Write 2 to 3 as 2:3.';

const ratios: LessonResponse = {
  id: ratiosId,
  courseId: mathsId,
  subject: 'Maths',
  position: 2,
  title: 'Ratios',
  summary: 'Comparing quantities.',
  body: `${firstParagraph}\n\n${secondParagraph}`,
};

const notFound: Reply = () => json({ statusCode: 404, message: 'Not Found' }, 404);
const badRequest: Reply = () =>
  json({ statusCode: 400, message: 'Validation failed (uuid is expected)', error: 'Bad Request' }, 400);

/** The session is valid; the lesson endpoint for the two ids in the address answers as the test says. */
function stubLessonApi(lessonReply: Reply) {
  return stubApi({
    'GET /api/session': () => json(sam),
    [`GET ${lessonApiPath}`]: lessonReply,
  });
}

/** The page is mounted the way the app mounts it: inside the session guard. */
function renderLesson() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[lessonPath]}>
        <Routes>
          <Route element={<RequireSession />}>
            <Route path="/lms/courses/:courseId/lessons/:lessonId" element={<LessonPage />} />
          </Route>
          <Route path="/login" element={<p data-testid="login-page">Login page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The page body; the LMS navigation in the header has its own link to /lms. */
const main = () => within(screen.getByRole('main'));

describe('LessonPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the subject, "Lesson <position>", the title and each paragraph, from the URL built from both route parameters (LMS-4)', async () => {
    const fetchMock = stubLessonApi(() => json(ratios));

    renderLesson();

    expect(await screen.findByRole('heading', { name: 'Ratios' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Maths');
    expect(screen.getByRole('main')).toHaveTextContent('Lesson 2');
    // Each paragraph is its own element: an exact match fails if the body is rendered as one block.
    expect(main().getByText(firstParagraph)).toBeInTheDocument();
    expect(main().getByText(secondParagraph)).toBeInTheDocument();
    expect(main().getByRole('link', { name: /Back to my courses/ })).toHaveAttribute('href', '/lms');
    expect(requestsTo(fetchMock, 'GET', lessonApiPath)).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a body containing <script> or HTML as text, not as markup (M22)', async () => {
    const scriptParagraph = '<script>window.lessonBodyRan = true</script>';
    const htmlParagraph = 'This is <b>not bold</b> and <img src="x" onerror="window.lessonBodyRan = true">.';
    stubLessonApi(() => json({ ...ratios, body: `${scriptParagraph}\n\n${htmlParagraph}` }));

    renderLesson();

    expect(await screen.findByRole('heading', { name: 'Ratios' })).toBeInTheDocument();
    expect(main().getByText(scriptParagraph)).toBeInTheDocument();
    expect(main().getByText(htmlParagraph)).toBeInTheDocument();
    const mainElement = screen.getByRole('main');
    expect(mainElement.querySelector('script')).toBeNull();
    expect(mainElement.querySelector('b')).toBeNull();
    expect(mainElement.querySelector('img')).toBeNull();
    expect((window as { lessonBodyRan?: boolean }).lessonBodyRan).toBeUndefined();
  });

  it.each<[string, Reply]>([
    ['404', notFound],
    ['400', badRequest],
  ])('shows "This lesson is not available." and a link to /lms after a %s (M23)', async (_status, reply) => {
    stubLessonApi(reply);

    renderLesson();

    expect(await main().findByText('This lesson is not available.')).toBeInTheDocument();
    expect(main().getByRole('link')).toHaveAttribute('href', '/lms');
    expect(screen.queryByRole('heading', { name: 'Ratios' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('ends on /login when the lesson request returns 401 because the session expired (M19)', async () => {
    // Like the real API: once the token has expired, the session endpoint says 401 as well.
    let expired = false;
    stubApi({
      'GET /api/session': () => (expired ? unauthorized() : json(sam)),
      [`GET ${lessonApiPath}`]: () => {
        expired = true;
        return unauthorized();
      },
    });

    renderLesson();

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ratios' })).not.toBeInTheDocument();
  });
});
