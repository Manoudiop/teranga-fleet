import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { api, createTestApp, registerCompany, type TestCompany } from './helpers';

describe('Vehicles (e2e)', () => {
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

  const create = (company: TestCompany, body: Record<string, unknown>) =>
    api(app, company.token).post('/vehicles').send(body);

  it('crée un véhicule, normalise la plaque et enregistre le relevé initial', async () => {
    const res = await create(a, {
      immatriculation: ' dk-1000-aa ',
      marque: 'Toyota',
      modele: 'Hilux',
      annee: 2019,
      dateAcquisition: '2019-06-14',
      kilometrageActuel: 120000,
    }).expect(201);

    expect(res.body).toMatchObject({
      immatriculation: 'DK-1000-AA',
      statut: 'ACTIVE',
      kilometrageActuel: 120000,
      companyId: a.companyId,
      currentDriver: null,
      counts: { mileageLogs: 1 },
    });
    expect(res.body.dateAcquisition).toBe('2019-06-14T00:00:00.000Z');
  });

  it('ignore tout companyId envoyé par le client (rejeté par la validation)', async () => {
    const res = await create(a, {
      immatriculation: 'DK-1001-AA',
      marque: 'Renault',
      modele: 'Master',
      companyId: b.companyId,
    }).expect(400);
    expect(res.body.details).toHaveProperty('companyId');
  });

  it("refuse une plaque déjà utilisée dans l'entreprise, mais l'accepte dans une autre", async () => {
    await create(a, { immatriculation: 'DK-2000-BB', marque: 'Kia', modele: 'K2700' }).expect(201);
    const res = await create(a, {
      immatriculation: 'dk-2000-bb',
      marque: 'Kia',
      modele: 'K2700',
    }).expect(409);
    expect(res.body.message).toBe('Un véhicule immatriculé DK-2000-BB existe déjà');
    await create(b, { immatriculation: 'DK-2000-BB', marque: 'Kia', modele: 'K2700' }).expect(201);
  });

  it('pagine, recherche et filtre par statut', async () => {
    const c = await registerCompany(app);
    for (const [plaque, statut] of [
      ['TH-1-AA', 'ACTIVE'],
      ['TH-2-AA', 'MAINTENANCE'],
      ['DK-3-AA', 'ACTIVE'],
      ['DK-4-AA', 'HORS_SERVICE'],
    ]) {
      await create(c, {
        immatriculation: plaque,
        marque: 'Peugeot',
        modele: 'Partner',
        statut,
      }).expect(201);
    }

    const page1 = await api(app, c.token).get('/vehicles?page=1&limit=3').expect(200);
    expect(page1.body.meta).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 });
    expect(page1.body.data.map((v: { immatriculation: string }) => v.immatriculation)).toEqual([
      'DK-3-AA',
      'DK-4-AA',
      'TH-1-AA',
    ]);

    const search = await api(app, c.token).get('/vehicles?search=dk').expect(200);
    expect(search.body.meta.total).toBe(2);

    const status = await api(app, c.token).get('/vehicles?status=ACTIVE').expect(200);
    expect(status.body.data.map((v: { immatriculation: string }) => v.immatriculation)).toEqual([
      'DK-3-AA',
      'TH-1-AA',
    ]);

    await api(app, c.token).get('/vehicles?limit=500').expect(400);
    await api(app, c.token).get('/vehicles?status=VOLE').expect(400);
  });

  it('modifie un véhicule sans permettre de toucher au kilométrage', async () => {
    const created = await create(a, {
      immatriculation: 'DK-3000-CC',
      marque: 'Isuzu',
      modele: 'D-Max',
    }).expect(201);
    const res = await api(app, a.token)
      .patch(`/vehicles/${created.body.id}`)
      .send({ statut: 'MAINTENANCE', type: 'Pick-up' })
      .expect(200);
    expect(res.body).toMatchObject({ statut: 'MAINTENANCE', type: 'Pick-up' });

    await api(app, a.token)
      .patch(`/vehicles/${created.body.id}`)
      .send({ kilometrageActuel: 0 })
      .expect(400);
  });

  describe('isolation multi-tenant', () => {
    let vehicleOfA: string;

    beforeAll(async () => {
      const res = await create(a, {
        immatriculation: 'DK-9999-ZZ',
        marque: 'Ford',
        modele: 'Ranger',
      }).expect(201);
      vehicleOfA = res.body.id;
    });

    it('B ne voit pas les véhicules de A dans sa liste', async () => {
      const res = await api(app, b.token).get('/vehicles?limit=100').expect(200);
      expect(res.body.data.every((v: { companyId: string }) => v.companyId === b.companyId)).toBe(
        true,
      );
      expect(res.body.data.find((v: { id: string }) => v.id === vehicleOfA)).toBeUndefined();
    });

    it('B reçoit 404 en lecture, modification et suppression du véhicule de A', async () => {
      await api(app, b.token).get(`/vehicles/${vehicleOfA}`).expect(404);
      await api(app, b.token)
        .patch(`/vehicles/${vehicleOfA}`)
        .send({ statut: 'HORS_SERVICE' })
        .expect(404);
      await api(app, b.token).delete(`/vehicles/${vehicleOfA}`).expect(404);

      const still = await api(app, a.token).get(`/vehicles/${vehicleOfA}`).expect(200);
      expect(still.body.statut).toBe('ACTIVE');
    });

    it('un identifiant mal formé renvoie 404', async () => {
      await api(app, a.token).get('/vehicles/pas-un-uuid').expect(404);
    });
  });

  it('supprime un véhicule', async () => {
    const created = await create(a, {
      immatriculation: 'DK-5000-EE',
      marque: 'Nissan',
      modele: 'Navara',
    }).expect(201);
    await api(app, a.token).delete(`/vehicles/${created.body.id}`).expect(204);
    await api(app, a.token).get(`/vehicles/${created.body.id}`).expect(404);
  });
});
