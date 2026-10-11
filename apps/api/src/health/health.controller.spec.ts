import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('renvoie le statut ok', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    const result = moduleRef.get(HealthController).check();
    expect(result.status).toBe('ok');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
