import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import {
  api,
  createDriver,
  createTestApp,
  createVehicle,
  isoDay,
  PASSWORD,
  registerCompany,
  uniqueEmail,
  type TestCompany,
  type TestDriver,
} from './helpers';

const PDF = Buffer.from('%PDF-1.7\n%%EOF\n', 'latin1');
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
type Route = [Method, string, Record<string, unknown>?];

/**
 * Matrice de sécurité transversale : chaque route qui vise une ressource de
 * l'entreprise A est appelée par le gestionnaire de B (attendu : 404, comme
 * une ressource inexistante) et chaque route de gestion par un chauffeur
 * (attendu : 403). Toute nouvelle route doit être ajoutée ici.
 */
describe('Matrice de sécurité (e2e)', () => {
  let app: INestApplication<App>;
  let a: TestCompany;
  let b: TestCompany;
  let driver: TestDriver;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    app = await createTestApp();
    a = await registerCompany(app, 'Entreprise A');
    b = await registerCompany(app, 'Entreprise B');

    ids.vehicle = (await createVehicle(app, a)).id;
    driver = await createDriver(app, a);
    ids.driver = driver.id;
    ids.assignment = (
      await api(app, a.token)
        .post('/assignments')
        .send({ vehicleId: ids.vehicle, driverId: ids.driver })
        .expect(201)
    ).body.id;
    ids.document = (
      await api(app, a.token)
        .post(`/vehicles/${ids.vehicle}/documents`)
        .field('type', 'ASSURANCE')
        .field('dateExpiration', isoDay(100))
        .attach('fichier', PDF, { filename: 'a.pdf', contentType: 'application/pdf' })
        .expect(201)
    ).body.id;
    ids.maintenance = (
      await api(app, a.token)
        .post('/maintenance')
        .send({
          vehicleId: ids.vehicle,
          type: 'Vidange',
          date: isoDay(-1),
          kilometrageAuMoment: 10_000,
          cout: 1,
        })
        .expect(201)
    ).body.id;
    ids.incident = (
      await api(app, driver.token)
        .post('/incidents')
        .field('type', 'PNEU')
        .field('severity', 'LOW')
        .field('description', 'x')
        .attach('photo', JPG, { filename: 'p.jpg', contentType: 'image/jpeg' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function call(token: string, [method, url, body]: Route) {
    const req = api(app, token)[method](url);
    return body ? req.send(body) : req;
  }

  const crossTenantRoutes = (): Route[] => [
    ['get', `/vehicles/${ids.vehicle}`],
    ['patch', `/vehicles/${ids.vehicle}`, { statut: 'HORS_SERVICE' }],
    ['delete', `/vehicles/${ids.vehicle}`],
    ['get', `/drivers/${ids.driver}`],
    ['patch', `/drivers/${ids.driver}`, { nom: 'X' }],
    ['delete', `/drivers/${ids.driver}`],
    ['put', `/drivers/${ids.driver}/account`, { email: uniqueEmail('x'), password: PASSWORD }],
    ['get', `/vehicles/${ids.vehicle}/documents`],
    ['get', `/documents/${ids.document}`],
    ['get', `/documents/${ids.document}/file`],
    ['patch', `/documents/${ids.document}`, { type: 'VIGNETTE' }],
    ['delete', `/documents/${ids.document}`],
    ['get', `/maintenance/${ids.maintenance}`],
    ['patch', `/maintenance/${ids.maintenance}`, { cout: 0 }],
    ['delete', `/maintenance/${ids.maintenance}`],
    [
      'post',
      '/maintenance',
      { vehicleId: ids.vehicle, type: 'X', date: isoDay(-1), kilometrageAuMoment: 1, cout: 1 },
    ],
    ['get', `/assignments/${ids.assignment}`],
    ['patch', `/assignments/${ids.assignment}`, { dateDebut: new Date().toISOString() }],
    ['post', `/assignments/${ids.assignment}/end`, {}],
    ['post', '/assignments', { vehicleId: ids.vehicle, driverId: ids.driver }],
    ['get', `/vehicles/${ids.vehicle}/mileage`],
    ['post', '/mileage', { vehicleId: ids.vehicle, kilometrage: 999_999 }],
    ['get', `/incidents/${ids.incident}`],
    ['get', `/incidents/${ids.incident}/photo`],
    ['patch', `/incidents/${ids.incident}`, { status: 'RESOLVED' }],
    [
      'post',
      '/incidents',
      { vehicleId: ids.vehicle, type: 'AUTRE', severity: 'LOW', description: 'x' },
    ],
  ];

  it("l'entreprise B reçoit 404 sur toutes les ressources de l'entreprise A", async () => {
    const failures: string[] = [];
    for (const route of crossTenantRoutes()) {
      const res = await call(b.token, route);
      if (res.status !== 404)
        failures.push(`${route[0].toUpperCase()} ${route[1]} -> ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it('les ressources de A sont intactes après les tentatives de B', async () => {
    const vehicle = await api(app, a.token).get(`/vehicles/${ids.vehicle}`).expect(200);
    expect(vehicle.body).toMatchObject({ statut: 'ACTIVE', kilometrageActuel: 10_000 });
    expect(vehicle.body.currentDriver?.id).toBe(ids.driver);
    await api(app, a.token).get(`/documents/${ids.document}/file`).expect(200);
    const incident = await api(app, a.token).get(`/incidents/${ids.incident}`).expect(200);
    expect(incident.body.status).toBe('OPEN');
  });

  it('les listes de B ne contiennent aucune donnée de A', async () => {
    const lists = [
      '/vehicles?limit=100',
      '/drivers?limit=100',
      '/documents?limit=100',
      '/maintenance?limit=100',
      '/assignments?limit=100',
      '/incidents?limit=100',
    ];
    for (const url of lists) {
      const res = await api(app, b.token).get(url).expect(200);
      expect(JSON.stringify(res.body)).not.toContain(a.companyId);
      expect(JSON.stringify(res.body)).not.toContain(ids.vehicle);
    }
    const alerts = await api(app, b.token).get('/alerts').expect(200);
    expect(JSON.stringify(alerts.body)).not.toContain(ids.vehicle);
  });

  it('un chauffeur reçoit 403 sur toutes les routes de gestion', async () => {
    const managerOnly: Route[] = [
      ['get', '/vehicles'],
      ['post', '/vehicles', { immatriculation: 'X-1', marque: 'A', modele: 'B' }],
      ['get', `/vehicles/${ids.vehicle}`],
      ['patch', `/vehicles/${ids.vehicle}`, { statut: 'HORS_SERVICE' }],
      ['delete', `/vehicles/${ids.vehicle}`],
      ['get', '/drivers'],
      [
        'post',
        '/drivers',
        { nom: 'X', prenom: 'Y', numeroPermis: 'Z', dateExpirationPermis: isoDay(10) },
      ],
      ['get', `/drivers/${ids.driver}`],
      ['patch', `/drivers/${ids.driver}`, { nom: 'X' }],
      ['delete', `/drivers/${ids.driver}`],
      ['put', `/drivers/${ids.driver}/account`, { email: uniqueEmail('x'), password: PASSWORD }],
      ['get', '/documents'],
      ['get', `/vehicles/${ids.vehicle}/documents`],
      [
        'post',
        `/vehicles/${ids.vehicle}/documents`,
        { type: 'ASSURANCE', dateExpiration: isoDay(10) },
      ],
      ['get', `/documents/${ids.document}`],
      ['get', `/documents/${ids.document}/file`],
      ['patch', `/documents/${ids.document}`, { type: 'VIGNETTE' }],
      ['delete', `/documents/${ids.document}`],
      ['get', '/maintenance'],
      ['get', '/maintenance/due'],
      [
        'post',
        '/maintenance',
        { vehicleId: ids.vehicle, type: 'X', date: isoDay(-1), kilometrageAuMoment: 1, cout: 1 },
      ],
      ['get', `/maintenance/${ids.maintenance}`],
      ['get', '/assignments'],
      ['post', '/assignments', { vehicleId: ids.vehicle, driverId: ids.driver }],
      ['post', `/assignments/${ids.assignment}/end`, {}],
      ['get', `/vehicles/${ids.vehicle}/mileage`],
      ['patch', `/incidents/${ids.incident}`, { status: 'RESOLVED' }],
      ['get', '/dashboard/summary'],
      ['get', '/dashboard/maintenance-costs'],
      ['get', '/admin/stats'],
      ['get', '/admin/companies'],
    ];
    const failures: string[] = [];
    for (const route of managerOnly) {
      const res = await call(driver.token, route);
      if (res.status !== 403)
        failures.push(`${route[0].toUpperCase()} ${route[1]} -> ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it('un gestionnaire reçoit 403 sur les routes réservées au chauffeur', async () => {
    await api(app, a.token).get('/drivers/me').expect(403);
    await api(app, a.token).get('/drivers/me/mileage').expect(403);
  });

  it('toutes les routes protégées refusent une requête anonyme', async () => {
    const res = await Promise.all(
      [
        '/vehicles',
        '/drivers',
        '/documents',
        '/maintenance',
        '/assignments',
        '/incidents',
        '/alerts',
        '/dashboard/summary',
      ].map((url) => api(app, '').get(url)),
    );
    expect(res.map((r) => r.status)).toEqual(Array(8).fill(401));
  });
});
