import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { AlertDigestService } from '../src/alerts/alert-digest.service';
import { MailService } from '../src/mail/mail.service';
import { MemoryMailService } from '../src/mail/memory-mail.service';
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

/** Jours fictifs : chaque test a ses propres entreprises, donc ses propres réservations. */
const DAY1 = new Date('2030-01-10T07:00:00Z');
const DAY2 = new Date('2030-01-11T07:00:00Z');
const DAY3 = new Date('2030-01-12T07:00:00Z');

describe('Récapitulatif quotidien des alertes (e2e)', () => {
  let app: INestApplication<App>;
  let digest: AlertDigestService;
  let mail: MemoryMailService;

  beforeAll(async () => {
    app = await createTestApp();
    digest = app.get(AlertDigestService);
    mail = app.get<MailService, MemoryMailService>(MailService);
  });

  afterAll(async () => {
    await app.close();
  });

  const run = (company: TestCompany, now: Date) => digest.run(now, [company.companyId]);

  async function addExpiredDocument(company: TestCompany, vehicleId: string) {
    await api(app, company.token)
      .post(`/vehicles/${vehicleId}/documents`)
      .field('type', 'ASSURANCE')
      .field('dateExpiration', isoDay(-3))
      .expect(201);
  }

  it('envoie un récapitulatif par jour aux gestionnaires, en signalant les nouveautés', async () => {
    const c = await registerCompany(app, 'Transports Ndar');
    const vehicle = await createVehicle(app, c, {
      immatriculation: 'SL-1001-A',
      statut: 'HORS_SERVICE',
    });

    expect(await run(c, DAY1)).toEqual({ sent: 1, skipped: 0 });
    const [first] = mail.to(c.email);
    expect(first.subject).toBe('Transports Ndar : 1 alerte à surveiller');
    expect(first.text).toContain('Le véhicule SL-1001-A est hors service');
    expect(first.text).toContain('http://localhost:3001/alerts');
    expect(first.text).not.toContain('[Nouveau]');

    // Jamais deux fois le même jour (redémarrage, deuxième instance de l'API).
    expect(await run(c, DAY1)).toEqual({ sent: 0, skipped: 1 });
    expect(mail.to(c.email)).toHaveLength(1);

    await addExpiredDocument(c, vehicle.id);
    await run(c, DAY2);
    const second = mail.to(c.email)[1];
    expect(second.subject).toBe('Transports Ndar : 1 alerte critique et 1 à surveiller');
    // Seule l'assurance, apparue depuis la veille, est marquée nouvelle.
    expect(second.text).toMatch(/\[Nouveau\] Assurance expirée/);
    expect(second.text).not.toMatch(/\[Nouveau\] Véhicule hors service/);
    expect(second.html).toContain('Nouveau</span>');
  });

  it("n'envoie rien à une flotte sans alerte", async () => {
    const c = await registerCompany(app);
    await createVehicle(app, c);
    expect(await run(c, DAY1)).toEqual({ sent: 0, skipped: 1 });
    expect(mail.to(c.email)).toHaveLength(0);
  });

  it('respecte le désabonnement et ne vise jamais les chauffeurs', async () => {
    const c = await registerCompany(app);
    await createVehicle(app, c, { statut: 'HORS_SERVICE' });
    const driver = await createDriver(app, c);

    const me = await api(app, c.token)
      .patch('/auth/preferences')
      .send({ alertDigest: false })
      .expect(200);
    expect(me.body.alertDigest).toBe(false);
    await api(app, driver.token)
      .patch('/auth/preferences')
      .send({ alertDigest: false })
      .expect(403);

    expect(await run(c, DAY1)).toEqual({ sent: 0, skipped: 0 });
    expect(mail.to(c.email)).toHaveLength(0);
    expect(mail.to(driver.email)).toHaveLength(0);

    await api(app, c.token).patch('/auth/preferences').send({ alertDigest: true }).expect(200);
    expect(await run(c, DAY3)).toEqual({ sent: 1, skipped: 0 });
    expect(mail.to(driver.email)).toHaveLength(0);
  });

  it("n'envoie rien à une entreprise suspendue ni aux comptes désactivés", async () => {
    const c = await registerCompany(app);
    await createVehicle(app, c, { statut: 'HORS_SERVICE' });
    const colleague = await api(app, c.token)
      .post('/users')
      .send({
        nom: 'Collègue',
        email: `collegue-${c.companyId}@test.example`,
        password: 'MotDePasse123',
      })
      .expect(201);
    await api(app, c.token)
      .patch(`/users/${colleague.body.id}`)
      .send({ disabled: true })
      .expect(200);

    await run(c, DAY1);
    expect(mail.to(c.email)).toHaveLength(1);
    expect(mail.to(colleague.body.email)).toHaveLength(0);

    await prismaOf(app).company.update({
      where: { id: c.companyId },
      data: { suspendedAt: new Date() },
    });
    expect(await run(c, DAY2)).toEqual({ sent: 0, skipped: 0 });
    expect(mail.to(c.email)).toHaveLength(1);
  });
});
