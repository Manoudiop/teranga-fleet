import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PasswordService } from '../src/auth/password.service';
import {
  api,
  createDriver,
  createTestApp,
  login,
  PASSWORD,
  prismaOf,
  registerCompany,
  uniqueEmail,
  type TestCompany,
} from './helpers';

const NEW_PASSWORD = 'NouveauMdp789';

describe('Gestion des comptes (e2e)', () => {
  let app: INestApplication<App>;
  let a: TestCompany;
  let b: TestCompany;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    app = await createTestApp();
    a = await registerCompany(app, 'Entreprise A');
    b = await registerCompany(app, 'Entreprise B');
    const email = uniqueEmail('admin');
    adminId = (
      await prismaOf(app).user.create({
        data: {
          nom: 'Admin',
          email,
          role: 'ADMIN',
          password: await app.get(PasswordService).hash(PASSWORD),
        },
      })
    ).id;
    adminToken = await login(app, email);
  });

  afterAll(async () => {
    await app.close();
  });

  const tryLogin = (email: string, password = PASSWORD) =>
    request(app.getHttpServer()).post('/auth/login').send({ email, password });

  describe('changement de son mot de passe', () => {
    it('exige le mot de passe actuel et un nouveau mot de passe différent', async () => {
      const c = await registerCompany(app);
      const me = api(app, c.token);
      await me
        .put('/auth/password')
        .send({ currentPassword: 'Mauvais123', newPassword: NEW_PASSWORD })
        .expect(400);
      await me
        .put('/auth/password')
        .send({ currentPassword: PASSWORD, newPassword: PASSWORD })
        .expect(400);
      await me
        .put('/auth/password')
        .send({ currentPassword: PASSWORD, newPassword: 'court' })
        .expect(400);

      await me
        .put('/auth/password')
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(204);
      await tryLogin(c.email).expect(401);
      await tryLogin(c.email, NEW_PASSWORD).expect(200);
    });

    it('est disponible pour un chauffeur (mot de passe provisoire)', async () => {
      const driver = await createDriver(app, a);
      await api(app, driver.token)
        .put('/auth/password')
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(204);
      await tryLogin(driver.email, NEW_PASSWORD).expect(200);
    });
  });

  describe('équipe (gestionnaire)', () => {
    it('ajoute un gestionnaire qui peut se connecter', async () => {
      const email = uniqueEmail('collegue');
      const res = await api(app, a.token)
        .post('/users')
        .send({ nom: 'Awa Ndiaye', email, password: PASSWORD })
        .expect(201);
      expect(res.body).toMatchObject({
        email,
        role: 'GESTIONNAIRE',
        companyId: a.companyId,
        disabledAt: null,
      });
      expect(res.body.password).toBeUndefined();
      await tryLogin(email).expect(200);

      const list = await api(app, a.token).get('/users').expect(200);
      expect(list.body.map((u: { email: string }) => u.email)).toEqual(
        expect.arrayContaining([a.email, email]),
      );
      expect(list.body.every((u: { role: string }) => u.role === 'GESTIONNAIRE')).toBe(true);
    });

    it('désactive un collègue : connexion refusée et session en cours coupée', async () => {
      const email = uniqueEmail('collegue');
      const created = await api(app, a.token)
        .post('/users')
        .send({ nom: 'X', email, password: PASSWORD })
        .expect(201);
      const colleagueToken = await login(app, email);

      await api(app, a.token)
        .patch(`/users/${created.body.id}`)
        .send({ disabled: true })
        .expect(200);

      const session = await api(app, colleagueToken).get('/vehicles').expect(401);
      expect(session.body.error).toBe('ACCOUNT_DISABLED');
      const attempt = await tryLogin(email).expect(403);
      expect(attempt.body).toMatchObject({ error: 'ACCOUNT_DISABLED' });
      // Un mauvais mot de passe ne révèle pas que le compte est désactivé.
      expect((await tryLogin(email, 'Mauvais123').expect(401)).body.error).toBe(
        'INVALID_CREDENTIALS',
      );

      await api(app, a.token)
        .patch(`/users/${created.body.id}`)
        .send({ disabled: false })
        .expect(200);
      await tryLogin(email).expect(200);
    });

    it('réinitialise le mot de passe d’un collègue', async () => {
      const email = uniqueEmail('collegue');
      const created = await api(app, a.token)
        .post('/users')
        .send({ nom: 'X', email, password: PASSWORD })
        .expect(201);
      await api(app, a.token)
        .put(`/users/${created.body.id}/password`)
        .send({ password: NEW_PASSWORD })
        .expect(204);
      await tryLogin(email, NEW_PASSWORD).expect(200);
    });

    it('interdit de se désactiver soi-même', async () => {
      const res = await api(app, a.token)
        .patch(`/users/${a.userId}`)
        .send({ disabled: true })
        .expect(400);
      expect(res.body.message).toMatch(/propre compte/);
    });

    it('refuse un email déjà utilisé', async () => {
      await api(app, a.token)
        .post('/users')
        .send({ nom: 'X', email: b.email, password: PASSWORD })
        .expect(409);
    });

    it('ne touche ni aux comptes chauffeurs ni aux comptes des autres entreprises', async () => {
      const driver = await createDriver(app, a);
      const driverUser = await prismaOf(app).driver.findUniqueOrThrow({ where: { id: driver.id } });
      await api(app, a.token)
        .patch(`/users/${driverUser.userId}`)
        .send({ disabled: true })
        .expect(404);
      await api(app, a.token).patch(`/users/${b.userId}`).send({ disabled: true }).expect(404);
      await api(app, a.token)
        .put(`/users/${b.userId}/password`)
        .send({ password: NEW_PASSWORD })
        .expect(404);
      const list = await api(app, b.token).get('/users').expect(200);
      expect(list.body.some((u: { companyId: string }) => u.companyId === a.companyId)).toBe(false);
      await api(app, driver.token).get('/users').expect(403);
    });
  });

  describe('administration de la plateforme', () => {
    it('suspend une entreprise : tous ses comptes sont coupés, puis la réactive', async () => {
      const c = await registerCompany(app, 'Mauvais payeur');
      const driver = await createDriver(app, c);

      const res = await api(app, adminToken)
        .patch(`/admin/companies/${c.companyId}/status`)
        .send({ suspended: true })
        .expect(200);
      expect(res.body.suspendedAt).toEqual(expect.any(String));

      expect((await api(app, c.token).get('/vehicles').expect(401)).body.error).toBe(
        'COMPANY_SUSPENDED',
      );
      expect((await api(app, driver.token).get('/drivers/me').expect(401)).body.error).toBe(
        'COMPANY_SUSPENDED',
      );
      expect((await tryLogin(c.email).expect(403)).body.error).toBe('COMPANY_SUSPENDED');
      // Les autres entreprises ne sont pas affectées.
      await api(app, a.token).get('/vehicles').expect(200);

      const list = await api(app, adminToken)
        .get('/admin/companies?search=Mauvais%20payeur')
        .expect(200);
      expect(list.body.data[0].suspendedAt).toEqual(expect.any(String));

      await api(app, adminToken)
        .patch(`/admin/companies/${c.companyId}/status`)
        .send({ suspended: false })
        .expect(200);
      await api(app, c.token).get('/vehicles').expect(200);
    });

    it("crée le compte gestionnaire d'une entreprise", async () => {
      const email = uniqueEmail('nouveau.gestionnaire');
      const res = await api(app, adminToken)
        .post(`/admin/companies/${b.companyId}/managers`)
        .send({ nom: 'Nouveau', email, password: PASSWORD })
        .expect(201);
      expect(res.body).toMatchObject({ role: 'GESTIONNAIRE', companyId: b.companyId });
      await tryLogin(email).expect(200);
      await api(app, adminToken)
        .post('/admin/companies/00000000-0000-4000-8000-000000000000/managers')
        .send({ nom: 'X', email: uniqueEmail('x'), password: PASSWORD })
        .expect(404);
    });

    it('désactive et réinitialise n’importe quel compte, sauf le sien', async () => {
      const driver = await createDriver(app, b);
      const driverUser = await prismaOf(app).driver.findUniqueOrThrow({ where: { id: driver.id } });
      await api(app, adminToken)
        .patch(`/admin/users/${driverUser.userId}`)
        .send({ disabled: true })
        .expect(200);
      expect((await api(app, driver.token).get('/drivers/me').expect(401)).body.error).toBe(
        'ACCOUNT_DISABLED',
      );
      await api(app, adminToken)
        .patch(`/admin/users/${driverUser.userId}`)
        .send({ disabled: false })
        .expect(200);

      await api(app, adminToken)
        .put(`/admin/users/${driverUser.userId}/password`)
        .send({ password: NEW_PASSWORD })
        .expect(204);
      await tryLogin(driver.email, NEW_PASSWORD).expect(200);

      await api(app, adminToken)
        .patch(`/admin/users/${adminId}`)
        .send({ disabled: true })
        .expect(400);
    });

    it("le détail d'une entreprise liste ses comptes sans mot de passe, avec leur état", async () => {
      const res = await api(app, adminToken).get(`/admin/companies/${a.companyId}`).expect(200);
      expect(res.body.users.length).toBeGreaterThan(0);
      expect(
        res.body.users.every(
          (u: Record<string, unknown>) => !('password' in u) && 'disabledAt' in u,
        ),
      ).toBe(true);
    });

    it('les routes d’administration restent réservées au rôle ADMIN', async () => {
      await api(app, a.token)
        .patch(`/admin/companies/${a.companyId}/status`)
        .send({ suspended: true })
        .expect(403);
      await api(app, a.token)
        .patch(`/admin/users/${b.userId}`)
        .send({ disabled: true })
        .expect(403);
    });
  });
});
