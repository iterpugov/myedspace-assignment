import { Controller, Get, Header, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { StudentResponse } from '@mes/contracts';
import { IdentityService } from './identity.service';
import { CurrentStudentId, SessionGuard } from './session.guard';

@Controller('session')
export class SessionController {
  constructor(private readonly identity: IdentityService) {}

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
}
