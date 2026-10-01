import type { INestApplication } from '@nestjs/common';

/** Application-wide settings shared by main.ts and the integration tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
}
