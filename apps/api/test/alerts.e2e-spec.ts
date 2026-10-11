import { INestApplication } from '@nestjs/common';
import type { Alert } from '@teranga-fleet/shared';
import { App } from 'supertest/types';
import {
  api,
  createDriver,
  createTestApp,
  createVehicle,
  isoDay,
  registerCompany,
  type TestCompany,
  type TestDriver,
} from './helpers';

describe('Alerts (e2e)', () => {
  let app: INestApplication<App>;
  let a: TestCompany;
  let b: TestCompany;
  let ok: { id: string };
  let fleet: { id: string };
  let broken: { id: string };
  let driver: TestDriver;

  const addDocument = (company: TestCompany, vehicleId: string, type: string, days: number) =>
    api(app, company.token)
      .post(`/vehicles/${vehicleId}/documents`)
      .field('type', type)
      .field('dateExpiration', isoDay(days))
      .expect(201);

  beforeAll(async () => {
    app = await createTestApp();
    a = await registerCompany(app, 'Entreprise A');
    b = await registerCompany(app, 'Entreprise B');

    ok = await createVehicle(app, a, { immatriculation: 'DK-OK-1' });
    fleet = await createVehicle(app, a, { immatriculation: 'DK-ALR-1', kilometrageActuel: 50_000 });
    broken = await createVehicle(app, a, { immatriculation: 'DK-HS-1', statut: 'HORS_SERVICE' });

    await addDocument(a, ok.id, 'ASSURANCE', 300);
    await addDocument(a, fleet.id, 'VIGNETTE', -10); // expirée
    await addDocument(a, fleet.id, 'ASSURANCE', 5); // expire bientôt
    await addDocument(a, fleet.id, 'VISITE_TECHNIQUE', -30); // ancienne...
    await addDocument(a, fleet.id, 'VISITE_TECHNIQUE', 335); // ...renouvelée : pas d'alerte

    await api(app, a.token)
      .post('/maintenance')
      .send({
        vehicleId: fleet.id,
        type: 'Révision',
        date: isoDay(-200),
        kilometrageAuMoment: 40_000,
        cout: 100_000,
        prochainEntretienKm: 49_000,
      })
      .expect(201);

    driver = await createDriver(app, a, { prenom: 'Lamine', dateExpirationPermis: isoDay(15) });
    await createDriver(app, a, {
      prenom: 'Inactif',
      statut: 'INACTIF',
      dateExpirationPermis: isoDay(-100),
    });
    await api(app, a.token)
      .post('/assignments')
      .send({ vehicleId: fleet.id, driverId: driver.id })
      .expect(201);

    await api(app, driver.token)
      .post('/incidents')
      .field('type', 'ACCIDENT')
      .field('severity', 'CRITICAL')
      .field('description', 'Collision au rond-point')
      .expect(201);
    await api(app, driver.token)
      .post('/incidents')
      .field('type', 'PNEU')
      .field('severity', 'LOW')
      .field('description', 'Pression basse')
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('renvoie les alertes structurées de la flotte, triées par priorité', async () => {
    const res = await api(app, a.token).get('/alerts').expect(200);
    const alerts = res.body as Alert[];

    expect(alerts.map((x) => [x.type, x.severity])).toEqual([
      // CRITICAL d'abord, échéance la plus ancienne en premier (sans date en dernier).
      ['DOCUMENT_EXPIRED', 'CRITICAL'],
      ['INCIDENT_OPEN', 'CRITICAL'],
      ['MAINTENANCE_OVERDUE', 'CRITICAL'],
      ['DOCUMENT_EXPIRING', 'WARNING'],
      ['LICENSE_EXPIRING', 'WARNING'],
      ['VEHICLE_OUT_OF_SERVICE', 'WARNING'],
    ]);
    expect(alerts[0]).toEqual({
      id: expect.stringMatching(/^document:/),
      type: 'DOCUMENT_EXPIRED',
      severity: 'CRITICAL',
      title: 'Vignette expirée',
      message: expect.stringContaining('DK-ALR-1'),
      vehicleId: fleet.id,
      driverId: null,
      documentId: expect.any(String),
      maintenanceId: null,
      incidentId: null,
      date: `${isoDay(-10)}T00:00:00.000Z`,
    });
    expect(alerts.find((x) => x.type === 'MAINTENANCE_OVERDUE')?.maintenanceId).toEqual(
      expect.any(String),
    );
    // Le chauffeur inactif au permis expiré, le document renouvelé et l'incident mineur n'alertent pas.
    expect(alerts.some((x) => x.message.includes('Inactif'))).toBe(false);
  });

  it('filtre par véhicule, gravité et type', async () => {
    const byVehicle = await api(app, a.token).get(`/alerts?vehicleId=${broken.id}`).expect(200);
    expect(byVehicle.body.map((x: Alert) => x.type)).toEqual(['VEHICLE_OUT_OF_SERVICE']);
    const critical = await api(app, a.token).get('/alerts?severity=CRITICAL').expect(200);
    expect(critical.body).toHaveLength(3);
    const licenses = await api(app, a.token).get('/alerts?type=LICENSE_EXPIRING').expect(200);
    expect(licenses.body).toHaveLength(1);
    await api(app, a.token).get('/alerts?severity=URGENT').expect(400);
  });

  it('filtre la liste des véhicules avec ou sans alerte', async () => {
    const withAlerts = await api(app, a.token).get('/vehicles?alerts=true').expect(200);
    expect(withAlerts.body.data.map((v: { immatriculation: string }) => v.immatriculation)).toEqual(
      ['DK-ALR-1', 'DK-HS-1'],
    );
    const without = await api(app, a.token).get('/vehicles?alerts=false').expect(200);
    expect(without.body.data.map((v: { immatriculation: string }) => v.immatriculation)).toEqual([
      'DK-OK-1',
    ]);
  });

  it('un chauffeur ne reçoit que les alertes de son véhicule et de son permis', async () => {
    const res = await api(app, driver.token).get('/alerts').expect(200);
    const alerts = res.body as Alert[];
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((x) => x.vehicleId === fleet.id || x.driverId === driver.id)).toBe(true);
    expect(alerts.some((x) => x.type === 'LICENSE_EXPIRING')).toBe(true);
    expect(alerts.some((x) => x.type === 'VEHICLE_OUT_OF_SERVICE')).toBe(false);
  });

  it("un chauffeur sans affectation ne voit que l'alerte de son permis", async () => {
    const free = await createDriver(app, a, { dateExpirationPermis: isoDay(3) });
    const res = await api(app, free.token).get('/alerts').expect(200);
    expect(res.body.map((x: Alert) => x.type)).toEqual(['LICENSE_EXPIRING']);
  });

  it("n'expose jamais les alertes d'une autre entreprise", async () => {
    const res = await api(app, b.token).get('/alerts').expect(200);
    expect(res.body).toEqual([]);
  });
});
