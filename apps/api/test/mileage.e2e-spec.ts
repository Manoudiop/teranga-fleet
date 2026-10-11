import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import {
  api,
  createDriver,
  createTestApp,
  createVehicle,
  registerCompany,
  type TestCompany,
  type TestDriver,
} from './helpers';

describe('Mileage (e2e)', () => {
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

  /** Véhicule à 10 000 km affecté à un nouveau chauffeur. */
  async function assignedDriver(company: TestCompany) {
    const vehicle = await createVehicle(app, company, { kilometrageActuel: 10_000 });
    const driver = await createDriver(app, company);
    await api(app, company.token)
      .post('/assignments')
      .send({ vehicleId: vehicle.id, driverId: driver.id })
      .expect(201);
    return { vehicle, driver };
  }

  const reading = (who: { token: string }, body: Record<string, unknown>) =>
    api(app, who.token).post('/mileage').send(body);

  describe('chauffeur', () => {
    let vehicle: { id: string };
    let driver: TestDriver;

    beforeAll(async () => {
      ({ vehicle, driver } = await assignedDriver(a));
    });

    it('saisit le kilométrage de son véhicule (déduit de son affectation) et met à jour le compteur', async () => {
      const res = await reading(driver, { kilometrage: 10_250 }).expect(201);
      expect(res.body).toMatchObject({
        kilometrage: 10_250,
        source: 'APP',
        driverId: driver.id,
        vehicle: { id: vehicle.id, kilometrageActuel: 10_250 },
      });
      const v = await api(app, a.token).get(`/vehicles/${vehicle.id}`).expect(200);
      expect(v.body.kilometrageActuel).toBe(10_250);
    });

    it('refuse un kilométrage inférieur au compteur, sans rien enregistrer', async () => {
      const res = await reading(driver, { kilometrage: 10_100 }).expect(400);
      expect(res.body).toEqual({
        statusCode: 400,
        error: 'MILEAGE_TOO_LOW',
        message:
          'Le kilométrage saisi (10 100 km) est inférieur au kilométrage actuel du véhicule (10 250 km)',
      });
      const history = await api(app, a.token).get(`/vehicles/${vehicle.id}/mileage`).expect(200);
      expect(history.body.data.map((l: { kilometrage: number }) => l.kilometrage)).toEqual([
        10_250, 10_000,
      ]);
    });

    it('accepte un relevé égal au compteur', async () => {
      await reading(driver, { kilometrage: 10_250 }).expect(201);
    });

    it('refuse une date future ou antérieure au dernier relevé', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      await reading(driver, { kilometrage: 10_300, date: tomorrow }).expect(400);
      const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const res = await reading(driver, { kilometrage: 10_300, date: lastWeek }).expect(400);
      expect(res.body.message).toMatch(/antérieure au dernier relevé/);
    });

    it('refuse un autre véhicule que celui qui lui est affecté', async () => {
      const other = await createVehicle(app, a, { kilometrageActuel: 5_000 });
      const res = await reading(driver, { vehicleId: other.id, kilometrage: 6_000 }).expect(403);
      expect(res.body.message).toMatch(/véhicule qui vous est affecté/);
      const v = await api(app, a.token).get(`/vehicles/${other.id}`).expect(200);
      expect(v.body.kilometrageActuel).toBe(5_000);
    });

    it('consulte son historique', async () => {
      const res = await api(app, driver.token).get('/drivers/me/mileage').expect(200);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data[0]).toMatchObject({ source: 'APP', vehicle: { id: vehicle.id } });
    });

    it("n'a pas accès à l'historique complet d'un véhicule", async () => {
      await api(app, driver.token).get(`/vehicles/${vehicle.id}/mileage`).expect(403);
    });

    it("ne peut plus saisir une fois l'affectation terminée", async () => {
      const { driver: d } = await assignedDriver(a);
      const list = await api(app, a.token)
        .get(`/assignments?driverId=${d.id}&active=true`)
        .expect(200);
      await api(app, a.token).post(`/assignments/${list.body.data[0].id}/end`).send({}).expect(200);
      const res = await reading(d, { kilometrage: 20_000 }).expect(409);
      expect(res.body.error).toBe('NO_ACTIVE_ASSIGNMENT');
    });
  });

  describe('gestionnaire', () => {
    it('saisit un relevé manuel pour un véhicule de la flotte', async () => {
      const vehicle = await createVehicle(app, a, { kilometrageActuel: 1_000 });
      const res = await reading(a, { vehicleId: vehicle.id, kilometrage: 1_500 }).expect(201);
      expect(res.body).toMatchObject({
        source: 'MANUEL',
        driverId: null,
        vehicle: { kilometrageActuel: 1_500 },
      });
    });

    it('doit préciser le véhicule', async () => {
      await reading(a, { kilometrage: 1_500 }).expect(400);
    });

    it("ne peut pas saisir sur le véhicule d'une autre entreprise", async () => {
      const vehicleOfA = await createVehicle(app, a, { kilometrageActuel: 1_000 });
      await reading(b, { vehicleId: vehicleOfA.id, kilometrage: 999_999 }).expect(404);
      await api(app, b.token).get(`/vehicles/${vehicleOfA.id}/mileage`).expect(404);
      const v = await api(app, a.token).get(`/vehicles/${vehicleOfA.id}`).expect(200);
      expect(v.body.kilometrageActuel).toBe(1_000);
    });
  });

  it('ne laisse jamais le compteur redescendre, même avec des saisies simultanées', async () => {
    const vehicle = await createVehicle(app, a, { kilometrageActuel: 0 });
    const values = [5_000, 3_000, 4_000, 1_000, 2_000];
    await Promise.all(
      values.map((kilometrage) => reading(a, { vehicleId: vehicle.id, kilometrage })),
    );

    const v = await api(app, a.token).get(`/vehicles/${vehicle.id}`).expect(200);
    expect(v.body.kilometrageActuel).toBe(5_000);
    const history = await api(app, a.token)
      .get(`/vehicles/${vehicle.id}/mileage?limit=100`)
      .expect(200);
    const kms = history.body.data.map((l: { kilometrage: number }) => l.kilometrage);
    expect(Math.max(...kms)).toBe(5_000);
  });
});
