import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { SESSION_COOKIE, SESSION_LIFETIME_SECONDS } from './session.constants';

@Injectable()
export class SessionService {
  constructor(private readonly jwt: JwtService) {}

  /** Signs the student in: sets the session cookie on the response. */
  start(response: Response, studentId: string): void {
    response.cookie(SESSION_COOKIE, this.jwt.sign({ sub: studentId }), {
      // Not readable by scripts, and never sent on requests that start on another site.
      httpOnly: true,
      sameSite: 'strict',
      path: '/api',
      maxAge: SESSION_LIFETIME_SECONDS * 1000,
      // The compose stack serves plain http on localhost, where a Secure cookie would be dropped.
      secure: process.env.COOKIE_SECURE === 'true',
    });
  }

  /** The student a token belongs to, or undefined if it is forged, expired or malformed. */
  verify(token: string): { studentId: string } | undefined {
    try {
      const payload: unknown = this.jwt.verify(token);
      if (typeof payload !== 'object' || payload === null) return undefined;
      const { sub, exp } = payload as { sub?: unknown; exp?: unknown };
      // A token without an expiry would never end; this service never issues one.
      return typeof sub === 'string' && sub !== '' && typeof exp === 'number' ? { studentId: sub } : undefined;
    } catch {
      return undefined;
    }
  }
}
