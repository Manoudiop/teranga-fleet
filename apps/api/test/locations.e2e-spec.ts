import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { LocationsService } from '../src/locations/locations.service';
import {
  api,
  createDriver,
  createTestApp,
  createVehicle,
  prismaOf,
  registerCompany,
  type TestCompany,
  type TestDriver,
} from './helpers';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const DAKAR = { latitude: 14.6928, longitude: -17.4467 };

describe('Géolocalisation (e2e)', () => {
  let app: INestApplication<App>;
  let a: TestCompany;
  let b: TestCompany;
  let vehicle: { id: string; immatriculation: string };
  let driver: TestDriver;

  beforeAll(async () => {
    app = await createTestApp();
    a = await registerCompany(app, 'Entreprise A');
    b = await registerCompany(app, 'Entreprise B');
    vehicle = await createVehicle(app, a, { immatriculation: 'DK-GPS-1' });
    driver = await createDriver(app, a, { prenom: 'Babacar' });
    await api(app, a.token)
      .post('/assignments')
      .send({ vehicleId: vehicle.id, driverId: driver.id, dateDebut: minutesAgo(120) })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const send = (who: { token: string }, points: Record<string, unknown>[]) =>
    api(app, who.token).post('/locations').send({ points });

  it('enregistre un lot de positions sur le véhicule affecté, sans doublon', async () => {
    const points = [
      { ...DAKAR, accuracy: 8, speed: 12.5, heading: 90, recordedAt: minutesAgo(10) },
      { latitude: 14.7, longitude: -17.44, accuracy: 10, recordedAt: minutesAgo(5) },
    ];
    expect((await send(driver, points).expect(200)).body).toEqual({
      accepted: 2,
      duplicates: 0,
      rejected: 0,
    });

    // La file hors ligne du téléphone peut renvoyer les mêmes points.
    expect((await send(driver, points).expect(200)).body).toEqual({
      accepted: 0,
      duplicates: 2,
      rejected: 0,
    });

    const stored = await prismaOf(app).vehicleLocation.findMany({
      where: { vehicleId: vehicle.id },
    });
    expect(stored).toHaveLength(2);
    expect(stored.every((p) => p.driverId === driver.id && p.companyId === a.companyId)).toBe(true);
  });

  it('écarte les points invalides sans rejeter le lot', async () => {
    const res = await send(driver, [
      { ...DAKAR, recordedAt: minutesAgo(3) },
      { ...DAKAR, recordedAt: minutesAgo(-60) }, // futur
      { ...DAKAR, recordedAt: minutesAgo(300) }, // avant l'affectation
      { ...DAKAR, accuracy: 9_000, recordedAt: minutesAgo(2) }, // imprécis
    ]).expect(200);
    expect(res.body).toEqual({ accepted: 1, duplicates: 0, rejected: 3 });
  });

  it('valide les coordonnées et la taille du lot', async () => {
    await send(driver, [{ latitude: 95, longitude: 0, recordedAt: minutesAgo(1) }]).expect(400);
    await send(driver, []).expect(400);
    await send(driver, [{ ...DAKAR }]).expect(400);
  });

  it("refuse l'envoi d'un chauffeur sans affectation", async () => {
    const free = await createDriver(app, a);
    const res = await send(free, [{ ...DAKAR, recordedAt: minutesAgo(1) }]).expect(409);
    expect(res.body.error).toBe('NO_ACTIVE_ASSIGNMENT');
  });

  it('donne au gestionnaire la dernière position de chaque véhicule', async () => {
    const res = await api(app, a.token).get('/locations/latest').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      latitude: DAKAR.latitude,
      longitude: DAKAR.longitude,
      vehicle: { id: vehicle.id, immatriculation: 'DK-GPS-1' },
      driver: { id: driver.id, prenom: 'Babacar' },
    });
    expect(new Date(res.body[0].recordedAt).getTime()).toBeGreaterThan(Date.now() - 4 * 60_000);
  });

  it("donne le tracé d'un véhicule, dans l'ordre chronologique", async () => {
    const res = await api(app, a.token).get(`/vehicles/${vehicle.id}/locations`).expect(200);
    expect(res.body.truncated).toBe(false);
    const times = res.body.points.map((p: { recordedAt: string }) => p.recordedAt);
    expect(times).toEqual([...times].sort());
    expect(res.body.points).toHaveLength(3);

    await api(app, a.token)
      .get(`/vehicles/${vehicle.id}/locations?from=${minutesAgo(1)}&to=${minutesAgo(10)}`)
      .expect(400);
    await api(app, a.token)
      .get(`/vehicles/${vehicle.id}/locations?from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z`)
      .expect(400);
  });

  it('isole les positions entre entreprises et entre rôles', async () => {
    expect((await api(app, b.token).get('/locations/latest').expect(200)).body).toEqual([]);
    await api(app, b.token).get(`/vehicles/${vehicle.id}/locations`).expect(404);
    await api(app, driver.token).get('/locations/latest').expect(403);
    await api(app, driver.token).get(`/vehicles/${vehicle.id}/locations`).expect(403);
    await api(app, a.token)
      .post('/locations')
      .send({ points: [{ ...DAKAR, recordedAt: minutesAgo(1) }] })
      .expect(403);
  });

  it('purge les positions au-delà de la durée de conservation', async () => {
    const service = app.get(LocationsService);
    const in100Days = new Date(Date.now() + 100 * 24 * 3600 * 1000);
    const before = await prismaOf(app).vehicleLocation.count({ where: { vehicleId: vehicle.id } });
    expect(before).toBeGreaterThan(0);
    await service.purgeExpired(in100Days);
    expect(await prismaOf(app).vehicleLocation.count({ where: { vehicleId: vehicle.id } })).toBe(0);
  });
});
