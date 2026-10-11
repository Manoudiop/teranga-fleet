import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './helpers';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health est public et vérifie la base', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('renvoie une 404 au format standard', async () => {
    const res = await request(app.getHttpServer()).get('/route-inexistante').expect(404);
    expect(res.body).toEqual({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'Ressource introuvable',
    });
  });
});
