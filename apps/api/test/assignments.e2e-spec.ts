import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import {
  api,
  createDriver,
  createTestApp,
  createVehicle,
  isoDay,
  registerCompany,
  type TestCompany,
} from './helpers';

describe('Assignments (e2e)', () => {
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

  const assign = (company: TestCompany, body: Record<string, unknown>) =>
    api(app, company.token).post('/assignments').send(body);

  it('affecte un chauffeur, visible sur le véhicule, le chauffeur et son profil mobile', async () => {
    const vehicle = await createVehicle(app, a, { immatriculation: 'DK-AFF-1' });
    const driver = await createDriver(app, a, { prenom: 'Fatou' });

    const res = await assign(a, { vehicleId: vehicle.id, driverId: driver.id }).expect(201);
    expect(res.body).toMatchObject({
      active: true,
      dateFin: null,
      vehicle: { immatriculation: 'DK-AFF-1' },
      driver: { prenom: 'Fatou' },
    });

    const v = await api(app, a.token).get(`/vehicles/${vehicle.id}`).expect(200);
    expect(v.body.currentDriver).toMatchObject({ id: driver.id, prenom: 'Fatou' });
    const d = await api(app, a.token).get(`/drivers/${driver.id}`).expect(200);
    expect(d.body.currentVehicle).toMatchObject({ id: vehicle.id });
    const me = await api(app, driver.token).get('/drivers/me').expect(200);
    expect(me.body.currentVehicle).toMatchObject({ immatriculation: 'DK-AFF-1' });
  });

  it('refuse un véhicule déjà affecté et un chauffeur déjà occupé', async () => {
    const vehicle = await createVehicle(app, a, { immatriculation: 'DK-AFF-2' });
    const other = await createVehicle(app, a);
    const driver = await createDriver(app, a, { prenom: 'Aliou', nom: 'Cissé' });
    const second = await createDriver(app, a);
    await assign(a, { vehicleId: vehicle.id, driverId: driver.id }).expect(201);

    const busyVehicle = await assign(a, { vehicleId: vehicle.id, driverId: second.id }).expect(409);
    expect(busyVehicle.body).toMatchObject({
      error: 'VEHICLE_UNAVAILABLE',
      message: 'Le véhicule DK-AFF-2 est déjà affecté à Aliou Cissé',
    });
    const busyDriver = await assign(a, { vehicleId: other.id, driverId: driver.id }).expect(409);
    expect(busyDriver.body.error).toBe('DRIVER_UNAVAILABLE');
  });

  it('garantit une seule affectation active même en cas de requêtes simultanées', async () => {
    const vehicle = await createVehicle(app, a);
    const drivers = await Promise.all([
      createDriver(app, a),
      createDriver(app, a),
      createDriver(app, a),
    ]);

    const results = await Promise.all(
      drivers.map((d) => assign(a, { vehicleId: vehicle.id, driverId: d.id })),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    const active = await api(app, a.token)
      .get(`/assignments?vehicleId=${vehicle.id}&active=true`)
      .expect(200);
    expect(active.body.meta.total).toBe(1);
  });

  it('refuse un véhicule hors service, un chauffeur inactif ou au permis expiré', async () => {
    const outOfService = await createVehicle(app, a, { statut: 'HORS_SERVICE' });
    const vehicle = await createVehicle(app, a);
    const driver = await createDriver(app, a);
    const inactive = await createDriver(app, a, { statut: 'INACTIF' });
    const expired = await createDriver(app, a, { dateExpirationPermis: isoDay(-1) });

    expect(
      (await assign(a, { vehicleId: outOfService.id, driverId: driver.id }).expect(409)).body.error,
    ).toBe('VEHICLE_UNAVAILABLE');
    expect(
      (await assign(a, { vehicleId: vehicle.id, driverId: inactive.id }).expect(409)).body.error,
    ).toBe('DRIVER_UNAVAILABLE');
    expect(
      (await assign(a, { vehicleId: vehicle.id, driverId: expired.id }).expect(409)).body.message,
    ).toMatch(/permis .* expiré/);
  });

  it('refuse une date de début dans le futur', async () => {
    const vehicle = await createVehicle(app, a);
    const driver = await createDriver(app, a);
    await assign(a, {
      vehicleId: vehicle.id,
      driverId: driver.id,
      dateDebut: `${isoDay(3)}T08:00:00Z`,
    }).expect(400);
  });

  it('termine une affectation, puis permet de réaffecter le véhicule', async () => {
    const vehicle = await createVehicle(app, a);
    const first = await createDriver(app, a);
    const second = await createDriver(app, a);
    const created = await assign(a, {
      vehicleId: vehicle.id,
      driverId: first.id,
      dateDebut: `${isoDay(-10)}T08:00:00Z`,
    }).expect(201);

    const ended = await api(app, a.token)
      .post(`/assignments/${created.body.id}/end`)
      .send({ dateFin: `${isoDay(-2)}T18:00:00Z` })
      .expect(200);
    expect(ended.body).toMatchObject({ active: false, dateFin: `${isoDay(-2)}T18:00:00.000Z` });

    const again = await api(app, a.token)
      .post(`/assignments/${created.body.id}/end`)
      .send({})
      .expect(409);
    expect(again.body.message).toMatch(/déjà terminée/);

    await assign(a, { vehicleId: vehicle.id, driverId: second.id }).expect(201);
    const history = await api(app, a.token).get(`/assignments?vehicleId=${vehicle.id}`).expect(200);
    expect(history.body.data.map((x: { active: boolean }) => x.active)).toEqual([true, false]);
  });

  it('refuse une fin antérieure au début', async () => {
    const vehicle = await createVehicle(app, a);
    const driver = await createDriver(app, a);
    const created = await assign(a, {
      vehicleId: vehicle.id,
      driverId: driver.id,
      dateDebut: `${isoDay(-5)}T08:00:00Z`,
    }).expect(201);
    await api(app, a.token)
      .post(`/assignments/${created.body.id}/end`)
      .send({ dateFin: `${isoDay(-6)}T08:00:00Z` })
      .expect(400);
  });

  it("refuse une période qui chevauche l'historique", async () => {
    const vehicle = await createVehicle(app, a, { immatriculation: 'DK-HIST' });
    const first = await createDriver(app, a);
    const second = await createDriver(app, a);
    const old = await assign(a, {
      vehicleId: vehicle.id,
      driverId: first.id,
      dateDebut: `${isoDay(-30)}T08:00:00Z`,
    }).expect(201);
    await api(app, a.token)
      .post(`/assignments/${old.body.id}/end`)
      .send({ dateFin: `${isoDay(-10)}T18:00:00Z` })
      .expect(200);

    // Nouvelle affectation démarrant pendant l'ancienne période.
    const overlap = await assign(a, {
      vehicleId: vehicle.id,
      driverId: second.id,
      dateDebut: `${isoDay(-20)}T08:00:00Z`,
    }).expect(409);
    expect(overlap.body.message).toMatch(/chevauche l'affectation .* sur DK-HIST/);

    // Correction des dates qui ferait chevaucher les deux périodes.
    const current = await assign(a, {
      vehicleId: vehicle.id,
      driverId: second.id,
      dateDebut: `${isoDay(-5)}T08:00:00Z`,
    }).expect(201);
    await api(app, a.token)
      .patch(`/assignments/${current.body.id}`)
      .send({ dateDebut: `${isoDay(-15)}T08:00:00Z` })
      .expect(409);
    await api(app, a.token)
      .patch(`/assignments/${current.body.id}`)
      .send({ dateDebut: `${isoDay(-8)}T08:00:00Z` })
      .expect(200);
  });

  it('empêche de désactiver un chauffeur qui a une affectation en cours', async () => {
    const vehicle = await createVehicle(app, a);
    const driver = await createDriver(app, a);
    await assign(a, { vehicleId: vehicle.id, driverId: driver.id }).expect(201);
    const res = await api(app, a.token)
      .patch(`/drivers/${driver.id}`)
      .send({ statut: 'SUSPENDU' })
      .expect(409);
    expect(res.body.message).toMatch(/Terminez d'abord l'affectation/);
  });

  describe('isolation et droits', () => {
    it('B ne peut pas affecter les véhicules ou chauffeurs de A, ni voir ses affectations', async () => {
      const vehicleA = await createVehicle(app, a);
      const driverA = await createDriver(app, a);
      const vehicleB = await createVehicle(app, b);
      const driverB = await createDriver(app, b);

      await assign(b, { vehicleId: vehicleA.id, driverId: driverB.id }).expect(404);
      await assign(b, { vehicleId: vehicleB.id, driverId: driverA.id }).expect(404);
      await assign(b, { vehicleId: vehicleA.id, driverId: driverA.id }).expect(404);

      const ofA = await assign(a, { vehicleId: vehicleA.id, driverId: driverA.id }).expect(201);
      await api(app, b.token).get(`/assignments/${ofA.body.id}`).expect(404);
      await api(app, b.token).post(`/assignments/${ofA.body.id}/end`).send({}).expect(404);
      await api(app, b.token)
        .patch(`/assignments/${ofA.body.id}`)
        .send({ dateFin: new Date().toISOString() })
        .expect(404);
      const list = await api(app, b.token).get('/assignments?limit=100').expect(200);
      expect(list.body.data.some((x: { id: string }) => x.id === ofA.body.id)).toBe(false);
    });

    it('un chauffeur ne peut pas créer ni terminer une affectation', async () => {
      const vehicle = await createVehicle(app, a);
      const driver = await createDriver(app, a);
      await api(app, driver.token)
        .post('/assignments')
        .send({ vehicleId: vehicle.id, driverId: driver.id })
        .expect(403);
      await api(app, driver.token).get('/assignments').expect(403);
    });
  });
});
