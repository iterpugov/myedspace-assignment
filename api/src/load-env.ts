import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Host development only: picks up the repository-root .env when the API or the Prisma CLI
// runs from api/. In Docker there is no such file and compose supplies the environment.
const envFile = resolve(process.cwd(), '..', '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
