import { type INestApplication, ValidationPipe } from '@nestjs/common';

/** Application-wide settings shared by main.ts and the integration tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  // Unknown properties are an error, so a client cannot slip in fields such as a price.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
