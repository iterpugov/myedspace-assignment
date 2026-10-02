import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Logger,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { StudentResponse } from '@mes/contracts';
import type { Response } from 'express';
// A value import: the validation pipe needs the class at run time.
import { LoginRequestDto } from './dto/login-request.dto';
import { IdentityService } from './identity.service';
import { CurrentStudentId, SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Controller('session')
export class SessionController {
  private readonly logger = new Logger(SessionController.name);

  constructor(
    private readonly identity: IdentityService,
    private readonly sessions: SessionService,
  ) {}

  /** Who is signed in. */
  @Get()
  @UseGuards(SessionGuard)
  @Header('Cache-Control', 'no-store')
  async current(@CurrentStudentId() studentId: string): Promise<StudentResponse> {
    const student = await this.identity.findById(studentId);
    // A token can outlive its student; treat it like no session at all.
    if (!student) throw new UnauthorizedException();
    return student;
  }

  /** Signs in with username and password. One answer for every mismatch (ADR 026). */
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() body: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StudentResponse> {
    const student = await this.identity.authenticate(body.username, body.password);
    if (!student) {
      // The typed username is not logged: it may be a password typed into the wrong field.
      this.logger.warn('Sign-in failed');
      throw new UnauthorizedException('Invalid username or password');
    }

    this.sessions.start(response, student.id);
    this.logger.log(`Student ${student.id} signed in`);
    return student;
  }

  /** Signs out. Needs no session, so an expired one can still be cleared. */
  @Delete()
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  logout(@Res({ passthrough: true }) response: Response): void {
    this.sessions.end(response);
  }
}
