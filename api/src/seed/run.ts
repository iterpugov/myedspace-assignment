import '../load-env';
import { PrismaService } from '../prisma/prisma.service';
import { courses } from './data';
import { seedCourses } from './index';

/** Entry point of the seed step: `node dist/seed/run`, run by the `migrate` compose service. */
async function main(): Promise<void> {
  const prisma = new PrismaService();
  try {
    await seedCourses(prisma);
    console.log(`Seeded ${courses.length} courses`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
