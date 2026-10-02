import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Response } from 'express';
import { SESSION_COOKIE, SESSION_LIFETIME_SECONDS } from './session.constants';

/** Shared by setting and clearing: a browser drops a cookie only if these match. */
function cookieAttributes(): CookieOptions {
  return {
    // Not readable by scripts, and never sent on requests that start on another site.
    httpOnly: true,
    sameSite: 'strict',
    path: '/api',
    // The compose stack serves plain http on localhost, where a Secure cookie would be dropped.
    secure: process.env.COOKIE_SECURE === 'true',
  };
}

@Injectable()
export class SessionService {
  constructor(private readonly jwt: JwtService) {}

  /** Signs the student in: sets the session cookie on the response. */
  start(response: Response, studentId: string): void {
    response.cookie(SESSION_COOKIE, this.jwt.sign({ sub: studentId }), {
      ...cookieAttributes(),
      maxAge: SESSION_LIFETIME_SECONDS * 1000,
    });
  }

  /** Signs the student out of this browser. The token itself is not revoked (ADR 008). */
  end(response: Response): void {
    response.clearCookie(SESSION_COOKIE, cookieAttributes());
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
