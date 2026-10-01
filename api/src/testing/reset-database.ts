import type { PrismaClient } from '../generated/prisma/client';

/**
 * Empties every application table, so each test starts from a known state.
 * Tables are discovered at run time; new models need no change here.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const names = tables.map(({ tablename }) => `"public"."${tablename.replace(/"/g, '""')}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}
