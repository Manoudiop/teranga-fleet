import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { MailService } from '../src/mail/mail.service';
import { MemoryMailService } from '../src/mail/memory-mail.service';
import {
  api,
  createDriver,
  login,
  createTestApp,
  PASSWORD,
  prismaOf,
  registerCompany,
  uniqueEmail,
  type TestCompany,
} from './helpers';

const NEW_PASSWORD = 'NouveauMdp789';

/** Les tokens JWT sont datés à la seconde : on passe à la seconde suivante. */
const nextSecond = () => new Promise((resolve) => setTimeout(resolve, 1100));

describe('Mot de passe oublié (e2e)', () => {
  let app: INestApplication<App>;
  let mail: MemoryMailService;
  let a: TestCompany;

  beforeAll(async () => {
    app = await createTestApp();
    mail = app.get<MailService, MemoryMailService>(MailService);
    a = await registerCompany(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const forgot = (email: string) =>
    request(app.getHttpServer()).post('/auth/forgot-password').send({ email });
  const reset = (token: string, password: string) =>
    request(app.getHttpServer()).post('/auth/reset-password').send({ token, password });

  /** L'email part après la réponse HTTP : on l'attend quelques instants. */
  async function waitForMail(to: string, count = 1) {
    for (let i = 0; i < 50 && mail.to(to).length < count; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return mail.to(to);
  }

  function tokenOf(text: string): string {
    const match = /reset-password\?token=([\w-]+)/.exec(text);
    if (!match) throw new Error('Lien absent de l’email');
    return match[1];
  }

  /** Laisse au traitement en arrière-plan le temps de se terminer (cas « aucun email »). */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

  it('envoie un lien qui change le mot de passe et ferme les sessions ouvertes', async () => {
    const company = await registerCompany(app);
    await nextSecond();

    await forgot(company.email.toUpperCase()).expect(204);
    const [message] = await waitForMail(company.email);
    expect(message.subject).toBe('Réinitialisation de votre mot de passe');
    expect(message.text).toContain('http://localhost:3001/reset-password?token=');
    const token = tokenOf(message.text);

    const weak = await reset(token, 'court').expect(400);
    expect(weak.body.error).toBe('VALIDATION_ERROR');

    await reset(token, NEW_PASSWORD).expect(204);

    // La session ouverte avant la réinitialisation est fermée.
    await api(app, company.token).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: company.email, password: PASSWORD })
      .expect(401);
    const fresh = await login(app, company.email, NEW_PASSWORD);
    await api(app, fresh).get('/auth/me').expect(200);

    // Le lien ne sert qu'une fois.
    const reused = await reset(token, 'EncoreUnAutre123').expect(400);
    expect(reused.body).toMatchObject({
      error: 'INVALID_RESET_TOKEN',
      message: 'Ce lien de réinitialisation est invalide ou a expiré. Faites une nouvelle demande.',
    });
  });

  it('répond pareil pour un email inconnu, sans rien envoyer', async () => {
    const before = mail.sent.length;
    await forgot(uniqueEmail('inconnu')).expect(204);
    await settle();
    expect(mail.sent.length).toBe(before);
  });

  it("n'envoie qu'un email toutes les deux minutes pour un même compte", async () => {
    const company = await registerCompany(app);
    await forgot(company.email).expect(204);
    await waitForMail(company.email);
    await forgot(company.email).expect(204);
    await settle();
    expect(mail.to(company.email)).toHaveLength(1);
  });

  it("n'envoie rien à un compte désactivé", async () => {
    const colleague = await api(app, a.token)
      .post('/users')
      .send({ nom: 'Collègue', email: uniqueEmail('collegue'), password: PASSWORD })
      .expect(201);
    await api(app, a.token)
      .patch(`/users/${colleague.body.id}`)
      .send({ disabled: true })
      .expect(200);

    await forgot(colleague.body.email).expect(204);
    await settle();
    expect(mail.to(colleague.body.email)).toHaveLength(0);
  });

  it('refuse un lien expiré ou inventé', async () => {
    const company = await registerCompany(app);
    await forgot(company.email).expect(204);
    const [message] = await waitForMail(company.email);
    const token = tokenOf(message.text);

    await prismaOf(app).passwordResetToken.updateMany({
      where: { user: { email: company.email } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await reset(token, NEW_PASSWORD).expect(400);
    expect(expired.body.error).toBe('INVALID_RESET_TOKEN');

    const forged = await reset('x'.repeat(43), NEW_PASSWORD).expect(400);
    expect(forged.body.error).toBe('INVALID_RESET_TOKEN');
  });

  it('ne stocke que l’empreinte du jeton', async () => {
    const company = await registerCompany(app);
    await forgot(company.email).expect(204);
    const token = tokenOf((await waitForMail(company.email))[0].text);
    const stored = await prismaOf(app).passwordResetToken.findMany({
      where: { user: { email: company.email } },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).not.toContain(token);
    expect(stored[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('le lien sert aussi aux chauffeurs', async () => {
    const driver = await createDriver(app, a);
    await forgot(driver.email).expect(204);
    const token = tokenOf((await waitForMail(driver.email))[0].text);
    await reset(token, NEW_PASSWORD).expect(204);
    await login(app, driver.email, NEW_PASSWORD);
  });

  it('un nouveau mot de passe défini par le gestionnaire ferme les sessions du compte', async () => {
    const driver = await createDriver(app, a);
    await nextSecond();
    await api(app, a.token)
      .put(`/drivers/${driver.id}/account`)
      .send({ email: driver.email, password: NEW_PASSWORD })
      .expect(200);
    await api(app, driver.token).get('/drivers/me').expect(401);
    await login(app, driver.email, NEW_PASSWORD);
  });
});
