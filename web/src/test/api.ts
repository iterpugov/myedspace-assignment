import type { StudentResponse } from '@mes/contracts';

/** Test helpers for stubbing the API. Nothing here is a real account or credential. */

export const sam: StudentResponse = {
  id: '5f4e3d2c-1b0a-4f9e-8d7c-6b5a4f3e2d06',
  username: 'sam_07',
  firstName: 'Sam',
};

/** Not a real credential: a made-up value used only to fill forms in tests. */
export const fakePassword = 'test-only-password';

export type Reply = (init?: RequestInit) => Response | Promise<Response>;

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const noContent = () => new Response(null, { status: 204 });

export const unauthorized = () => json({ statusCode: 401, message: 'Unauthorized' }, 401);

/**
 * Replaces `fetch` with a table of replies keyed by "<METHOD> <path>", for example
 * "GET /api/session". A request that is not in the table rejects, so a page that calls
 * something it should not fails its test.
 */
export function stubApi(routes: Record<string, Reply>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const reply = routes[`${method} ${String(input)}`];
    if (!reply) throw new Error(`Unexpected request: ${method} ${String(input)}`);
    return reply(init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export type ApiStub = ReturnType<typeof stubApi>;

/** The calls made so far to one "<METHOD> <path>". */
export function requestsTo(fetchMock: ApiStub, method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([input, init]) => String(input) === path && (init?.method ?? 'GET').toUpperCase() === method,
  );
}

/** A reply that stays pending until the test calls `respond`. */
export function deferredReply() {
  let respond: (response: Response) => void = () => {};
  const pending = new Promise<Response>((resolve) => {
    respond = resolve;
  });
  return { reply: (() => pending) satisfies Reply, respond: (response: Response) => respond(response) };
}
