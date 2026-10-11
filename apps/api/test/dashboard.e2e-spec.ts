import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { PasswordService } from '../src/auth/password.service';
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

/** AAAA-MM du mois courant décalé de `offset` mois. */
function monthKey(offset: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
    .toISOString()
    .slice(0, 7);
}

describe('Dashboard et administration (e2e)', () => {
  let app: INestApplication<App>;
  let a: TestCompany;

  beforeAll(async () => {
    app = await createTestApp();
    a = await registerCompany(app, 'Flotte Dashboard');

    const v1 = await createVehicle(app, a, { kilometrageActuel: 50_000 });
    await createVehicle(app, a, { statut: 'MAINTENANCE' });
    await createVehicle(app, a, { statut: 'HORS_SERVICE' });
    await createVehicle(app, a);
    await createDriver(app, a);
    await createDriver(app, a, { statut: 'INACTIF' });

    const doc = (type: string, days: number) =>
      api(app, a.token)
        .post(`/vehicles/${v1.id}/documents`)
        .field('type', type)
        .field('dateExpiration', isoDay(days))
        .expect(201);
    await doc('VIGNETTE', -3);
    await doc('ASSURANCE', 7);

    const maintenance = (date: string, cout: number, extra: Record<string, unknown> = {}) =>
      api(app, a.token)
        .post('/maintenance')
        .send({
          vehicleId: v1.id,
          type: `Entretien ${cout}`,
          date,
          kilometrageAuMoment: 40_000,
          cout,
          ...extra,
        })
        .expect(201);
    await maintenance(isoDay(0), 120_000, { prochainEntretienKm: 45_000 }); // ce mois-ci, dépassé
    await maintenance(`${monthKey(-2)}-15`, 80_000);
    await maintenance(`${monthKey(-2)}-20`, 20_000);
    await maintenance(`${monthKey(-12)}-10`, 999_999); // hors de la fenêtre de 6 mois

    await api(app, a.token)
      .post('/incidents')
      .field('vehicleId', v1.id)
      .field('type', 'PANNE')
      .field('severity', 'MEDIUM')
      .field('description', 'Batterie')
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /dashboard/summary renvoie les indicateurs de la flotte', async () => {
    const res = await api(app, a.token).get('/dashboard/summary').expect(200);
    expect(res.body).toEqual({
      vehicles: { total: 4, active: 2, maintenance: 1, horsService: 1 },
      drivers: { total: 2, active: 1 },
      documents: { expired: 1, expiringSoon: 1 },
      licenses: { expired: 0, expiringSoon: 0 },
      maintenance: { overdue: 1, dueSoon: 0, costThisMonth: 120_000 },
      incidents: { open: 1 },
      alerts: { critical: 2, warning: 2, total: 5 },
    });
  });

  it('les compteurs concordent avec GET /alerts', async () => {
    const [summary, alerts] = await Promise.all([
      api(app, a.token).get('/dashboard/summary').expect(200),
      api(app, a.token).get('/alerts').expect(200),
    ]);
    expect(summary.body.alerts.total).toBe(alerts.body.length);
  });

  it('GET /dashboard/maintenance-costs renvoie une série mensuelle complète', async () => {
    const res = await api(app, a.token).get('/dashboard/maintenance-costs?months=6').expect(200);
    expect(res.body.months).toHaveLength(6);
    expect(res.body.months.map((m: { month: string }) => m.month)).toEqual(
      [-5, -4, -3, -2, -1, 0].map(monthKey),
    );
    expect(res.body.months[3]).toEqual({ month: monthKey(-2), total: 100_000, count: 2 });
    expect(res.body.months[4]).toEqual({ month: monthKey(-1), total: 0, count: 0 });
    expect(res.body.months[5]).toEqual({ month: monthKey(0), total: 120_000, count: 1 });
    expect(res.body.total).toBe(220_000);

    await api(app, a.token).get('/dashboard/maintenance-costs?months=0').expect(400);
    await api(app, a.token).get('/dashboard/maintenance-costs?months=25').expect(400);
  });

  it("une nouvelle entreprise a un tableau de bord vide, sans données d'autrui", async () => {
    const empty = await registerCompany(app);
    const res = await api(app, empty.token).get('/dashboard/summary').expect(200);
    expect(res.body.vehicles.total).toBe(0);
    expect(res.body.alerts.total).toBe(0);
    expect(res.body.maintenance.costThisMonth).toBe(0);
  });

  it('le dashboard est réservé au gestionnaire', async () => {
    const driver = await createDriver(app, a);
    await api(app, driver.token).get('/dashboard/summary').expect(403);
  });

  describe('administration de la plateforme', () => {
    let adminToken: string;

    beforeAll(async () => {
      const email = uniqueEmail('admin');
      await prismaOf(app).user.create({
        data: {
          nom: 'Admin',
          email,
          role: 'ADMIN',
          password: await app.get(PasswordService).hash(PASSWORD),
        },
      });
      adminToken = await login(app, email);
    });

    it("l'ADMIN voit les statistiques globales et la liste des entreprises", async () => {
      const stats = await api(app, adminToken).get('/admin/stats').expect(200);
      expect(stats.body.companies.total).toBeGreaterThanOrEqual(2);
      expect(stats.body.users.byRole.ADMIN).toBeGreaterThanOrEqual(1);

      const companies = await api(app, adminToken)
        .get('/admin/companies?search=Flotte%20Dashboard')
        .expect(200);
      expect(companies.body.data[0]).toMatchObject({
        id: a.companyId,
        nom: 'Flotte Dashboard',
        _count: { vehicles: 4 },
      });

      const detail = await api(app, adminToken).get(`/admin/companies/${a.companyId}`).expect(200);
      expect(detail.body.users.some((u: { role: string }) => u.role === 'GESTIONNAIRE')).toBe(true);
      expect(detail.body.users.every((u: Record<string, unknown>) => !('password' in u))).toBe(
        true,
      );
    });

    it("l'ADMIN n'a pas accès aux routes d'une entreprise (pas de companyId)", async () => {
      await api(app, adminToken).get('/vehicles').expect(403);
      await api(app, adminToken).get('/dashboard/summary').expect(403);
    });

    it("un gestionnaire ou un chauffeur n'a pas accès à l'administration", async () => {
      await api(app, a.token).get('/admin/stats').expect(403);
      await api(app, a.token).get('/admin/companies').expect(403);
    });
  });
});
