import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { LoginResponse } from '@teranga-fleet/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export const PASSWORD = 'MotDePasse123';

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  setupApp(app);
  await app.init();
  return app;
}

/** Email unique par appel : les tests ne dépendent d'aucune donnée existante. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}.${randomUUID().slice(0, 8)}@e2e.example`;
}

export interface TestCompany {
  token: string;
  companyId: string;
  userId: string;
  email: string;
}

export async function registerCompany(
  app: INestApplication<App>,
  nom = 'Entreprise Test',
): Promise<TestCompany> {
  const email = uniqueEmail('gestionnaire');
  const res = await request(app.getHttpServer())
    .post('/auth/register-company')
    .send({
      entreprise: { nom, email: uniqueEmail('contact') },
      gestionnaire: { nom: 'Gestionnaire Test', email, password: PASSWORD },
    })
    .expect(201);
  const body = res.body as LoginResponse;
  return { token: body.accessToken, companyId: body.user.company!.id, userId: body.user.id, email };
}

export async function login(app: INestApplication<App>, email: string, password = PASSWORD) {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  return (res.body as LoginResponse).accessToken;
}

/** Requête authentifiée. */
export function api(app: INestApplication<App>, token: string) {
  const server = app.getHttpServer();
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  return {
    get: (url: string) => auth(request(server).get(url)),
    post: (url: string) => auth(request(server).post(url)),
    patch: (url: string) => auth(request(server).patch(url)),
    put: (url: string) => auth(request(server).put(url)),
    delete: (url: string) => auth(request(server).delete(url)),
  };
}

export function prismaOf(app: INestApplication): PrismaService {
  return app.get(PrismaService);
}

/** Date AAAA-MM-JJ décalée de `days` jours par rapport à aujourd'hui (UTC). */
export function isoDay(days = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

let plateCounter = 0;

/** Crée un véhicule avec une immatriculation unique. */
export async function createVehicle(
  app: INestApplication<App>,
  company: TestCompany,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; immatriculation: string }> {
  plateCounter += 1;
  const res = await api(app, company.token)
    .post('/vehicles')
    .send({
      immatriculation: `T-${randomUUID().slice(0, 4).toUpperCase()}-${plateCounter}`,
      marque: 'Toyota',
      modele: 'Hilux',
      kilometrageActuel: 10000,
      ...overrides,
    })
    .expect(201);
  return res.body as { id: string; immatriculation: string };
}

export interface TestDriver {
  id: string;
  email: string;
  token: string;
}

/** Crée un chauffeur avec son compte mobile et le connecte. */
export async function createDriver(
  app: INestApplication<App>,
  company: TestCompany,
  overrides: Record<string, unknown> = {},
): Promise<TestDriver> {
  const email = uniqueEmail('chauffeur');
  const res = await api(app, company.token)
    .post('/drivers')
    .send({
      nom: 'Ndiaye',
      prenom: 'Cheikh',
      numeroPermis: `P-${randomUUID().slice(0, 8)}`,
      dateExpirationPermis: isoDay(400),
      compte: { email, password: PASSWORD },
      ...overrides,
    })
    .expect(201);
  return { id: (res.body as { id: string }).id, email, token: await login(app, email) };
}
