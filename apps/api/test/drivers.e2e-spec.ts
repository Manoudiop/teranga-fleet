import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import {
  api,
  createDriver,
  createTestApp,
  createVehicle,
  isoDay,
  login,
  PASSWORD,
  prismaOf,
  registerCompany,
  uniqueEmail,
  type TestCompany,
} from './helpers';

describe('Drivers (e2e)', () => {
  let app: INestApplication<App>;
  let a: TestCompany;
  let b: TestCompany;

  beforeAll(async () => {
    app = await createTestApp();
    a = await registerCompany(app, 'Entreprise A');
    b = await registerCompany(app, 'Entreprise B');
  });

  afterAll(async () => {
    await app.close();
  });

  it('crée un chauffeur avec son compte mobile, utilisable pour se connecter', async () => {
    const email = uniqueEmail('awa');
    const res = await api(app, a.token)
      .post('/drivers')
      .send({
        nom: 'Ba',
        prenom: 'Awa',
        contact: '+221 77 000 00 00',
        numeroPermis: 'sn-dk-1',
        dateExpirationPermis: isoDay(500),
        compte: { email, password: PASSWORD },
      })
      .expect(201);

    expect(res.body).toMatchObject({
      nom: 'Ba',
      prenom: 'Awa',
      numeroPermis: 'SN-DK-1',
      statut: 'ACTIF',
      permisStatus: 'VALIDE',
      account: { email },
      currentVehicle: null,
      assignments: [],
    });
    expect(res.body.userId).toEqual(expect.any(String));

    const token = await login(app, email);
    const me = await api(app, token).get('/auth/me').expect(200);
    expect(me.body).toMatchObject({
      role: 'CHAUFFEUR',
      driver: { id: res.body.id, prenom: 'Awa' },
    });
  });

  it('crée un chauffeur sans compte, puis lui en attribue un et réinitialise son mot de passe', async () => {
    const created = await api(app, a.token)
      .post('/drivers')
      .send({
        nom: 'Sarr',
        prenom: 'Ibou',
        numeroPermis: 'SN-TH-77',
        dateExpirationPermis: isoDay(300),
      })
      .expect(201);
    expect(created.body.account).toBeNull();

    const email = uniqueEmail('ibou');
    await api(app, a.token)
      .put(`/drivers/${created.body.id}/account`)
      .send({ email, password: PASSWORD })
      .expect(200);
    await login(app, email);

    await api(app, a.token)
      .put(`/drivers/${created.body.id}/account`)
      .send({ email, password: 'NouveauMdp456' })
      .expect(200);
    await login(app, email, 'NouveauMdp456');
  });

  it('refuse un email de compte déjà utilisé, sans créer la fiche chauffeur', async () => {
    const before = await prismaOf(app).driver.count({ where: { companyId: a.companyId } });
    await api(app, a.token)
      .post('/drivers')
      .send({
        nom: 'X',
        prenom: 'Y',
        numeroPermis: 'SN-DUP-1',
        dateExpirationPermis: isoDay(100),
        compte: { email: a.email, password: PASSWORD },
      })
      .expect(409);
    expect(await prismaOf(app).driver.count({ where: { companyId: a.companyId } })).toBe(before);
  });

  it('calcule le statut du permis et filtre dessus', async () => {
    const c = await registerCompany(app);
    const mk = (prenom: string, days: number) =>
      api(app, c.token)
        .post('/drivers')
        .send({
          nom: 'Test',
          prenom,
          numeroPermis: `P-${prenom}`,
          dateExpirationPermis: isoDay(days),
        })
        .expect(201);
    await mk('Expire', -1);
    await mk('Bientot', 10);
    await mk('Aujourdhui', 0);
    await mk('Valide', 200);

    const all = await api(app, c.token).get('/drivers').expect(200);
    const status = Object.fromEntries(
      all.body.data.map((d: { prenom: string; permisStatus: string }) => [
        d.prenom,
        d.permisStatus,
      ]),
    );
    expect(status).toEqual({
      Expire: 'EXPIRE',
      Bientot: 'EXPIRANT_BIENTOT',
      Aujourdhui: 'EXPIRANT_BIENTOT',
      Valide: 'VALIDE',
    });

    const soon = await api(app, c.token).get('/drivers?permis=EXPIRANT_BIENTOT').expect(200);
    expect(soon.body.data.map((d: { prenom: string }) => d.prenom).sort()).toEqual([
      'Aujourdhui',
      'Bientot',
    ]);
    const expired = await api(app, c.token).get('/drivers?permis=EXPIRE').expect(200);
    expect(expired.body.data.map((d: { prenom: string }) => d.prenom)).toEqual(['Expire']);
    const search = await api(app, c.token).get('/drivers?search=bient').expect(200);
    expect(search.body.meta.total).toBe(1);
  });

  describe('suppression', () => {
    it('supprime un chauffeur sans historique et son compte', async () => {
      const driver = await createDriver(app, a);
      await api(app, a.token).delete(`/drivers/${driver.id}`).expect(204);
      await api(app, a.token).get(`/drivers/${driver.id}`).expect(404);
      await api(app, driver.token).get('/auth/me').expect(401);
    });

    it('refuse de supprimer un chauffeur qui a un historique et invite à le désactiver', async () => {
      const driver = await createDriver(app, a);
      const vehicle = await createVehicle(app, a);
      await prismaOf(app).assignment.create({
        data: {
          companyId: a.companyId,
          vehicleId: vehicle.id,
          driverId: driver.id,
          dateDebut: new Date('2025-01-01'),
          dateFin: new Date('2025-02-01'),
        },
      });

      const res = await api(app, a.token).delete(`/drivers/${driver.id}`).expect(409);
      expect(res.body.message).toMatch(/INACTIF/);
      await api(app, a.token)
        .patch(`/drivers/${driver.id}`)
        .send({ statut: 'INACTIF' })
        .expect(200);
    });
  });

  describe('rôle CHAUFFEUR', () => {
    it('voit son propre profil via /drivers/me', async () => {
      const driver = await createDriver(app, a, { prenom: 'Modou' });
      const res = await api(app, driver.token).get('/drivers/me').expect(200);
      expect(res.body).toMatchObject({ id: driver.id, prenom: 'Modou', currentVehicle: null });
      expect(res.body.assignments).toBeUndefined();
    });

    it("n'a accès à aucune route de gestion", async () => {
      const driver = await createDriver(app, a);
      const other = await createDriver(app, a);
      const vehicle = await createVehicle(app, a);
      const d = api(app, driver.token);

      await d.get('/drivers').expect(403);
      await d.get(`/drivers/${other.id}`).expect(403);
      await d.patch(`/drivers/${driver.id}`).send({ statut: 'ACTIF' }).expect(403);
      await d
        .put(`/drivers/${driver.id}/account`)
        .send({ email: uniqueEmail('x'), password: PASSWORD })
        .expect(403);
      await d.get('/vehicles').expect(403);
      await d.get(`/vehicles/${vehicle.id}`).expect(403);
      await d
        .post('/vehicles')
        .send({ immatriculation: 'X-1', marque: 'A', modele: 'B' })
        .expect(403);
      await d.delete(`/vehicles/${vehicle.id}`).expect(403);
    });

    it("un gestionnaire n'a pas de profil chauffeur", async () => {
      await api(app, a.token).get('/drivers/me').expect(403);
    });
  });

  it('isole les chauffeurs entre entreprises', async () => {
    const driverOfA = await createDriver(app, a);
    await api(app, b.token).get(`/drivers/${driverOfA.id}`).expect(404);
    await api(app, b.token).patch(`/drivers/${driverOfA.id}`).send({ nom: 'Pirate' }).expect(404);
    await api(app, b.token).delete(`/drivers/${driverOfA.id}`).expect(404);
    await api(app, b.token)
      .put(`/drivers/${driverOfA.id}/account`)
      .send({ email: uniqueEmail('x'), password: PASSWORD })
      .expect(404);
    const list = await api(app, b.token).get('/drivers?limit=100').expect(200);
    expect(list.body.data.some((d: { id: string }) => d.id === driverOfA.id)).toBe(false);
  });
});
