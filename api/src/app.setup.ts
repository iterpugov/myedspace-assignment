import { type INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';

/**
 * The API takes JSON bodies only. A cross-site HTML form can post urlencoded, multipart or
 * plain text without asking; it cannot post JSON, so no form on another site can sign a
 * browser in or place an order.
 */
function jsonBodiesOnly(request: Request, response: Response, next: NextFunction): void {
  // `is` answers null when there is no body, and false when there is one of another type.
  if (request.is('application/json') === false) {
    response.status(415).json({ statusCode: 415, message: 'Unsupported Media Type' });
    return;
  }
  next();
}

/** Application-wide settings shared by main.ts and the integration tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  // Registered before the body parsers, so a refused body is never parsed.
  app.use(jsonBodiesOnly);
  app.use(cookieParser());
  // Unknown properties are an error, so a client cannot slip in fields such as a price.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
