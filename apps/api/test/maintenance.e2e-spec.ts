import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import {
  api,
  createDriver,
  createTestApp,
  createVehicle,
  isoDay,
  prismaOf,
  registerCompany,
  type TestCompany,
} from './helpers';

describe('Maintenance (e2e)', () => {
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

  const add = (company: TestCompany, body: Record<string, unknown>) =>
    api(app, company.token).post('/maintenance').send(body);

  it('enregistre un entretien et fait avancer le compteur avec un relevé historisé', async () => {
    const v = await createVehicle(app, a, { kilometrageActuel: 50_000 });
    const res = await add(a, {
      vehicleId: v.id,
      type: 'Vidange',
      date: isoDay(-1),
      kilometrageAuMoment: 51_200,
      cout: 45_000,
      garage: 'Garage Touba Motors',
      prochainEntretienKm: 61_200,
    }).expect(201);

    expect(res.body).toMatchObject({
      type: 'Vidange',
      cout: 45_000,
      vehicle: { id: v.id, kilometrageActuel: 51_200 },
    });
    const logs = await prismaOf(app).mileageLog.findMany({
      where: { vehicleId: v.id },
      orderBy: { kilometrage: 'asc' },
    });
    expect(logs.map((l) => [l.kilometrage, l.source])).toEqual([
      [50_000, 'MANUEL'],
      [51_200, 'MANUEL'],
    ]);
  });

  it("un entretien ancien n'abaisse pas le compteur", async () => {
    const v = await createVehicle(app, a, { kilometrageActuel: 80_000 });
    await add(a, {
      vehicleId: v.id,
      type: 'Pneus',
      date: isoDay(-200),
      kilometrageAuMoment: 60_000,
      cout: 200_000,
    }).expect(201);
    const vehicle = await api(app, a.token).get(`/vehicles/${v.id}`).expect(200);
    expect(vehicle.body.kilometrageActuel).toBe(80_000);
  });

  it.each([
    ['une date future', { date: isoDay(2) }],
    [
      'un prochain kilométrage inférieur',
      { kilometrageAuMoment: 10_000, prochainEntretienKm: 9_000 },
    ],
    ['une prochaine date antérieure', { date: isoDay(-5), prochainEntretienDate: isoDay(-10) }],
    ['un coût négatif', { cout: -1 }],
  ])('refuse %s', async (_label, overrides) => {
    const v = await createVehicle(app, a);
    await add(a, {
      vehicleId: v.id,
      type: 'Révision',
      date: isoDay(-1),
      kilometrageAuMoment: 10_000,
      cout: 1000,
      ...overrides,
    }).expect(400);
  });

  it('liste avec filtres et coût total de la sélection', async () => {
    const c = await registerCompany(app);
    const v1 = await createVehicle(app, c, { immatriculation: 'DK-MNT-1' });
    const v2 = await createVehicle(app, c, { immatriculation: 'TH-MNT-2' });
    await add(c, {
      vehicleId: v1.id,
      type: 'Vidange',
      date: isoDay(-40),
      kilometrageAuMoment: 10_000,
      cout: 40_000,
    }).expect(201);
    await add(c, {
      vehicleId: v1.id,
      type: 'Freins',
      date: isoDay(-10),
      kilometrageAuMoment: 10_000,
      cout: 85_000,
    }).expect(201);
    await add(c, {
      vehicleId: v2.id,
      type: 'Vidange',
      date: isoDay(-5),
      kilometrageAuMoment: 10_000,
      cout: 42_000,
    }).expect(201);

    const all = await api(app, c.token).get('/maintenance').expect(200);
    expect(all.body.meta.total).toBe(3);
    expect(all.body.totalCout).toBe(167_000);
    expect(all.body.data[0].vehicle.immatriculation).toBe('TH-MNT-2');

    const byVehicle = await api(app, c.token).get(`/maintenance?vehicleId=${v1.id}`).expect(200);
    expect(byVehicle.body.totalCout).toBe(125_000);
    const search = await api(app, c.token).get('/maintenance?search=vidange').expect(200);
    expect(search.body.meta.total).toBe(2);
    const range = await api(app, c.token)
      .get(`/maintenance?from=${isoDay(-15)}`)
      .expect(200);
    expect(range.body.meta.total).toBe(2);
  });

  it("calcule les entretiens dépassés et à prévoir, les plus urgents d'abord", async () => {
    const c = await registerCompany(app);
    const overdue = await createVehicle(app, c, {
      immatriculation: 'DK-OVER',
      kilometrageActuel: 10_000,
    });
    const soon = await createVehicle(app, c, {
      immatriculation: 'DK-SOON',
      kilometrageActuel: 10_000,
    });
    const ok = await createVehicle(app, c, { immatriculation: 'DK-OK', kilometrageActuel: 10_000 });

    await add(c, {
      vehicleId: overdue.id,
      type: 'Révision',
      date: isoDay(-300),
      kilometrageAuMoment: 5_000,
      cout: 0,
      prochainEntretienKm: 9_000,
    }).expect(201);
    await add(c, {
      vehicleId: soon.id,
      type: 'Révision',
      date: isoDay(-300),
      kilometrageAuMoment: 5_000,
      cout: 0,
      prochainEntretienDate: isoDay(15),
    }).expect(201);
    await add(c, {
      vehicleId: ok.id,
      type: 'Révision',
      date: isoDay(-10),
      kilometrageAuMoment: 5_000,
      cout: 0,
      prochainEntretienKm: 50_000,
      prochainEntretienDate: isoDay(300),
    }).expect(201);

    const res = await api(app, c.token).get('/maintenance/due').expect(200);
    expect(
      res.body.map((d: { vehicle: { immatriculation: string }; level: string }) => [
        d.vehicle.immatriculation,
        d.level,
      ]),
    ).toEqual([
      ['DK-OVER', 'OVERDUE'],
      ['DK-SOON', 'SOON'],
    ]);
    expect(res.body[0].km).toMatchObject({ due: 9_000, current: 10_000, remaining: -1_000 });
    expect(res.body[1].date).toMatchObject({ daysRemaining: 15 });

    const forOne = await api(app, c.token).get(`/maintenance/due?vehicleId=${soon.id}`).expect(200);
    expect(forOne.body).toHaveLength(1);
    await api(app, c.token).get('/maintenance/due?vehicleId=pas-un-uuid').expect(400);
  });

  it('modifie et supprime un entretien', async () => {
    const v = await createVehicle(app, a);
    const created = await add(a, {
      vehicleId: v.id,
      type: 'Vidange',
      date: isoDay(-3),
      kilometrageAuMoment: 10_000,
      cout: 30_000,
    }).expect(201);

    const updated = await api(app, a.token)
      .patch(`/maintenance/${created.body.id}`)
      .send({ cout: 35_000, notes: 'Huile 5W30' })
      .expect(200);
    expect(updated.body).toMatchObject({ cout: 35_000, notes: 'Huile 5W30' });

    await api(app, a.token)
      .patch(`/maintenance/${created.body.id}`)
      .send({ prochainEntretienKm: 5_000 })
      .expect(400);
    await api(app, a.token)
      .patch(`/maintenance/${created.body.id}`)
      .send({ vehicleId: v.id })
      .expect(400);

    await api(app, a.token).delete(`/maintenance/${created.body.id}`).expect(204);
    await api(app, a.token).get(`/maintenance/${created.body.id}`).expect(404);
  });

  describe('isolation et droits', () => {
    it('B ne peut ni créer un entretien sur le véhicule de A, ni lire ou modifier ceux de A', async () => {
      const v = await createVehicle(app, a);
      const record = await add(a, {
        vehicleId: v.id,
        type: 'Vidange',
        date: isoDay(-3),
        kilometrageAuMoment: 10_000,
        cout: 1,
      }).expect(201);

      await add(b, {
        vehicleId: v.id,
        type: 'Vidange',
        date: isoDay(-3),
        kilometrageAuMoment: 10_000,
        cout: 1,
      }).expect(404);
      await api(app, b.token).get(`/maintenance/${record.body.id}`).expect(404);
      await api(app, b.token).patch(`/maintenance/${record.body.id}`).send({ cout: 0 }).expect(404);
      await api(app, b.token).delete(`/maintenance/${record.body.id}`).expect(404);
      const list = await api(app, b.token).get('/maintenance?limit=100').expect(200);
      expect(list.body.data.some((m: { id: string }) => m.id === record.body.id)).toBe(false);
      const due = await api(app, b.token).get('/maintenance/due').expect(200);
      expect(due.body.some((d: { vehicleId: string }) => d.vehicleId === v.id)).toBe(false);
    });

    it("un chauffeur n'a pas accès à la maintenance", async () => {
      const driver = await createDriver(app, a);
      await api(app, driver.token).get('/maintenance').expect(403);
      await api(app, driver.token).get('/maintenance/due').expect(403);
    });
  });
});
