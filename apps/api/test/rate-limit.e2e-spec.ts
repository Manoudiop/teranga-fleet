import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

describe('Limitation de débit sur /auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // La configuration est lue à l'import d'AppModule : on fixe la limite avant.
    process.env.AUTH_RATE_LIMIT = '3';
    const { createTestApp } = await import('./helpers.js');
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('bloque les tentatives de connexion au-delà de la limite', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'brute.force@e2e.example', password: 'Essai1234' });

    for (let i = 0; i < 3; i++) await attempt().expect(401);
    const res = await attempt().expect(429);
    expect(res.body).toEqual({
      statusCode: 429,
      error: 'TOO_MANY_REQUESTS',
      message: 'Trop de tentatives, réessayez dans une minute',
    });
  });

  it("n'applique pas cette limite aux autres routes", async () => {
    for (let i = 0; i < 5; i++) await request(app.getHttpServer()).get('/health').expect(200);
  });
});
