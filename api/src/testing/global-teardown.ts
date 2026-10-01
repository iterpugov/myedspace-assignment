import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

declare global {
  // eslint-disable-next-line no-var
  var __MES_TEST_DB__: StartedPostgreSqlContainer | undefined;
}

export default async function globalTeardown(): Promise<void> {
  await globalThis.__MES_TEST_DB__?.stop();
  globalThis.__MES_TEST_DB__ = undefined;
}
