import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SESSION_COOKIE } from './session.constants';
import { SessionService } from './session.service';

interface AuthenticatedRequest extends Request {
  studentId?: string;
}

/** Lets a request through only with a valid session cookie; reads no database. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies: Record<string, unknown> = request.cookies ?? {};
    const token = cookies[SESSION_COOKIE];
    const session = typeof token === 'string' ? this.sessions.verify(token) : undefined;
    if (!session) throw new UnauthorizedException();

    request.studentId = session.studentId;
    return true;
  }
}

/** The id of the signed-in student. Use only on routes behind SessionGuard. */
export const CurrentStudentId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const { studentId } = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!studentId) throw new UnauthorizedException();
  return studentId;
});
