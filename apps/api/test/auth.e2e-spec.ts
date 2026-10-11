import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { PasswordService } from '../src/auth/password.service';
import {
  api,
  createTestApp,
  login,
  PASSWORD,
  prismaOf,
  registerCompany,
  uniqueEmail,
} from './helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register-company', () => {
    it("crée l'entreprise et le gestionnaire, et renvoie un token", async () => {
      const email = uniqueEmail('gestionnaire');
      const res = await request(app.getHttpServer())
        .post('/auth/register-company')
        .send({
          entreprise: {
            nom: 'Sahel Transport',
            email: uniqueEmail('contact'),
            telephone: '+221 33 000 00 00',
          },
          gestionnaire: { nom: 'Awa Ba', email: email.toUpperCase(), password: PASSWORD },
        })
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({
        email, // normalisé en minuscules
        role: 'GESTIONNAIRE',
        company: { nom: 'Sahel Transport' },
        driver: null,
      });
      expect(res.body.user.password).toBeUndefined();
    });

    it("refuse un email déjà utilisé, sans créer d'entreprise orpheline", async () => {
      const { email } = await registerCompany(app);
      const before = await prismaOf(app).company.count();

      const res = await request(app.getHttpServer())
        .post('/auth/register-company')
        .send({
          entreprise: { nom: 'Doublon', email: uniqueEmail('contact') },
          gestionnaire: { nom: 'X', email, password: PASSWORD },
        })
        .expect(409);

      expect(res.body).toEqual({ statusCode: 409, error: 'CONFLICT', message: expect.any(String) });
      expect(await prismaOf(app).company.count()).toBe(before);
    });

    it('valide les champs et répond au format standard', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register-company')
        .send({
          entreprise: { nom: '', email: 'pas-un-email' },
          gestionnaire: { nom: 'X', email: uniqueEmail('g'), password: 'court' },
        })
        .expect(400);

      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.message).toMatch(/^Données invalides/);
      expect(Object.keys(res.body.details)).toEqual(
        expect.arrayContaining(['entreprise.nom', 'entreprise.email', 'gestionnaire.password']),
      );
    });

    it('rejette les champs inconnus, notamment un companyId ou un rôle imposé par le client', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register-company')
        .send({
          entreprise: { nom: 'X', email: uniqueEmail('contact') },
          gestionnaire: { nom: 'X', email: uniqueEmail('g'), password: PASSWORD, role: 'ADMIN' },
          companyId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(400);
      expect(Object.keys(res.body.details)).toEqual(
        expect.arrayContaining(['companyId', 'gestionnaire.role']),
      );
    });
  });

  describe('POST /auth/login', () => {
    it('connecte avec des identifiants valides (email insensible à la casse)', async () => {
      const { email } = await registerCompany(app);
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `  ${email.toUpperCase()} `, password: PASSWORD })
        .expect(200);
      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        user: { email, role: 'GESTIONNAIRE' },
      });
    });

    it('refuse un mauvais mot de passe', async () => {
      const { email } = await registerCompany(app);
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'Mauvais123' })
        .expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        error: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect',
      });
    });

    it('renvoie la même erreur pour un email inconnu', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail('inconnu'), password: PASSWORD })
        .expect(401);
      expect(res.body.message).toBe('Email ou mot de passe incorrect');
    });
  });

  describe('GET /auth/me', () => {
    it("renvoie le profil de l'utilisateur connecté", async () => {
      const company = await registerCompany(app, 'Profil SARL');
      const res = await api(app, company.token).get('/auth/me').expect(200);
      expect(res.body).toMatchObject({
        id: company.userId,
        email: company.email,
        role: 'GESTIONNAIRE',
        company: { id: company.companyId, nom: 'Profil SARL' },
      });
      expect(res.body.password).toBeUndefined();
    });

    it('refuse une requête sans token', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me').expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Authentification requise',
      });
    });

    it('refuse un token invalide', async () => {
      await api(app, 'pas.un.token').get('/auth/me').expect(401);
    });

    it('refuse un token signé avec un autre secret', async () => {
      const { userId } = await registerCompany(app);
      const forged = new JwtService().sign({ sub: userId }, { secret: 'x'.repeat(48) });
      await api(app, forged).get('/auth/me').expect(401);
    });

    it('refuse un token expiré', async () => {
      const { userId } = await registerCompany(app);
      const expired = app.get(JwtService).sign({ sub: userId }, { expiresIn: -10 });
      await api(app, expired).get('/auth/me').expect(401);
    });

    it("refuse le token d'un compte supprimé", async () => {
      const { token, userId } = await registerCompany(app);
      await prismaOf(app).user.delete({ where: { id: userId } });
      await api(app, token).get('/auth/me').expect(401);
    });
  });

  describe('Contrôle des rôles', () => {
    it("un ADMIN de la plateforme (sans entreprise) peut s'authentifier", async () => {
      const email = uniqueEmail('admin');
      await prismaOf(app).user.create({
        data: {
          nom: 'Admin',
          email,
          role: 'ADMIN',
          password: await app.get(PasswordService).hash(PASSWORD),
        },
      });
      const token = await login(app, email);
      const res = await api(app, token).get('/auth/me').expect(200);
      expect(res.body).toMatchObject({ role: 'ADMIN', company: null });
    });
  });
});
