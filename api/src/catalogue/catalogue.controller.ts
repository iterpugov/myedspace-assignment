import { Controller, Get } from '@nestjs/common';
import type { CourseResponse } from '@mes/contracts';
import { CatalogueService } from './catalogue.service';

@Controller('courses')
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  list(): Promise<CourseResponse[]> {
    return this.catalogue.listCourses();
  }
}
