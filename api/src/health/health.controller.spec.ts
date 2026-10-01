import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const queryRaw = jest.fn();

  async function createController(): Promise<HealthController> {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
    }).compile();
    return moduleRef.get(HealthController);
  }

  beforeEach(() => queryRaw.mockReset());

  it('reports ok when the database answers', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const controller = await createController();

    await expect(controller.check()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('answers 503 when the database is unreachable', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    const controller = await createController();

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
