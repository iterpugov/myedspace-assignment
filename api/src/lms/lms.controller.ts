import { Controller, Get, Header, NotFoundException, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import type { EnrolledCourseResponse, LessonResponse } from '@mes/contracts';
import { CurrentStudentId, SessionGuard } from '../identity/session.guard';
import { LearningService } from './learning.service';

/**
 * The guard is on the class, so a route added here cannot be left open by omission. The
 * student is always the one in the session, never one named by the request.
 */
@Controller('lms')
@UseGuards(SessionGuard)
export class LmsController {
  constructor(private readonly learning: LearningService) {}

  /** The dashboard: the student's courses, each with its list of lessons. */
  @Get('courses')
  @Header('Cache-Control', 'no-store')
  courses(@CurrentStudentId() studentId: string): Promise<EnrolledCourseResponse[]> {
    return this.learning.listCourses(studentId);
  }

  @Get('courses/:courseId/lessons/:lessonId')
  @Header('Cache-Control', 'no-store')
  async lesson(
    @CurrentStudentId() studentId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ): Promise<LessonResponse> {
    const lesson = await this.learning.openLesson(studentId, courseId, lessonId);
    // One answer for "not enrolled" and "no such lesson" (ADR 025).
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }
}
