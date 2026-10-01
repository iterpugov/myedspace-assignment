import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

declare global {
  // eslint-disable-next-line no-var
  var __MES_TEST_DB__: StartedPostgreSqlContainer | undefined;
}

const apiRoot = resolve(__dirname, '..', '..');

/** Starts one disposable PostgreSQL per test run and applies the real migrations to it. */
export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  globalThis.__MES_TEST_DB__ = container;

  const databaseUrl = container.getConnectionUri();
  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
  } catch (error) {
    await container.stop();
    throw error;
  }

  // Test processes inherit the environment, so PrismaService connects to the container.
  process.env.DATABASE_URL = databaseUrl;
}
