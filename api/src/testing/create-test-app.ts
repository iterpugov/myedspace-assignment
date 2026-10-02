import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';

/** The real application, configured as in main.ts, against the test run's database. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await listenOnLoopback(app);
  return app;
}

/**
 * Starts the app on a free port of 127.0.0.1. supertest would otherwise bind the wildcard
 * address and connect to 127.0.0.1: the OS can then hand out a port that another program
 * already holds on 127.0.0.1, and every request goes to that program instead.
 */
export async function listenOnLoopback(app: INestApplication): Promise<void> {
  await app.listen(0, '127.0.0.1');
}
