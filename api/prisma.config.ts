import './src/load-env';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Read directly so that `prisma generate` works without a database URL at build time.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
