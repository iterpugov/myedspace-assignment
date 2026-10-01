import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@mes/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      throw new ServiceUnavailableException('Database is unreachable');
    }
    return { status: 'ok', database: 'up' };
  }
}
