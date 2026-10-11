import { INestApplication } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
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

const PDF = Buffer.from(
  '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n%%EOF\n',
  'latin1',
);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

/** Chemin réel d'un fichier stocké localement (UPLOAD_DIR des tests). */
const storedPath = (key: string) => resolve(process.env.UPLOAD_DIR!, key);

describe('Documents (e2e)', () => {
  let app: INestApplication<App>;
  let a: TestCompany;
  let b: TestCompany;
  let vehicleId: string;

  beforeAll(async () => {
    app = await createTestApp();
    a = await registerCompany(app, 'Entreprise A');
    b = await registerCompany(app, 'Entreprise B');
    vehicleId = (await createVehicle(app, a, { immatriculation: 'DK-DOC-01' })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  const upload = (
    company: TestCompany,
    vId: string,
    fields: Record<string, string>,
    file?: [Buffer, string, string],
  ) => {
    const req = api(app, company.token).post(`/vehicles/${vId}/documents`);
    for (const [k, v] of Object.entries(fields)) void req.field(k, v);
    if (file) req.attach('fichier', file[0], { filename: file[1], contentType: file[2] });
    return req;
  };

  const keyOf = async (id: string) =>
    (await prismaOf(app).document.findUniqueOrThrow({ where: { id } })).fichierUrl;

  it('ajoute un document avec un PDF, stocké sous un nom généré', async () => {
    const res = await upload(
      a,
      vehicleId,
      { type: 'ASSURANCE', dateEmission: isoDay(-100), dateExpiration: isoDay(265) },
      [PDF, '../../piege nom.pdf', 'application/pdf'],
    ).expect(201);

    expect(res.body).toMatchObject({
      type: 'ASSURANCE',
      status: 'VALIDE',
      hasFile: true,
      fileType: 'pdf',
      vehicle: { immatriculation: 'DK-DOC-01' },
    });
    expect(res.body.fichierUrl).toBeUndefined();

    const key = await keyOf(res.body.id);
    expect(key).toMatch(new RegExp(`^companies/${a.companyId}/documents/[0-9a-f-]{36}\\.pdf$`));
    expect(existsSync(storedPath(key!))).toBe(true);
  });

  it('télécharge le fichier joint avec le bon type', async () => {
    const created = await upload(
      a,
      vehicleId,
      { type: 'CARTE_GRISE', dateExpiration: isoDay(3000) },
      [PDF, 'cg.pdf', 'application/pdf'],
    ).expect(201);

    const res = await api(app, a.token)
      .get(`/documents/${created.body.id}/file`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('inline; filename="carte_grise-DK-DOC-01.pdf"');
    expect(Buffer.compare(res.body as Buffer, PDF)).toBe(0);
  });

  it('accepte un document sans fichier', async () => {
    const res = await upload(a, vehicleId, { type: 'VIGNETTE', dateExpiration: isoDay(10) }).expect(
      201,
    );
    expect(res.body).toMatchObject({ hasFile: false, status: 'EXPIRANT_BIENTOT' });
    await api(app, a.token).get(`/documents/${res.body.id}/file`).expect(404);
  });

  it('refuse un faux PDF (contenu non conforme) avec une 415', async () => {
    const res = await upload(a, vehicleId, { type: 'ASSURANCE', dateExpiration: isoDay(100) }, [
      Buffer.from('<script>alert(1)</script>'),
      'facture.pdf',
      'application/pdf',
    ]).expect(415);
    expect(res.body.error).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('refuse un fichier trop volumineux avec une 413', async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(1024 * 1024 + 10)]);
    const res = await upload(a, vehicleId, { type: 'ASSURANCE', dateExpiration: isoDay(100) }, [
      big,
      'gros.pdf',
      'application/pdf',
    ]).expect(413);
    expect(res.body).toMatchObject({ error: 'FILE_TOO_LARGE', message: 'Fichier trop volumineux' });
  });

  it("refuse une expiration antérieure à l'émission", async () => {
    await upload(a, vehicleId, {
      type: 'ASSURANCE',
      dateEmission: isoDay(10),
      dateExpiration: isoDay(5),
    }).expect(400);
  });

  it('calcule le statut et filtre la liste globale', async () => {
    const c = await registerCompany(app);
    const v = await createVehicle(app, c);
    await upload(c, v.id, { type: 'VIGNETTE', dateExpiration: isoDay(-1) }).expect(201);
    await upload(c, v.id, { type: 'ASSURANCE', dateExpiration: isoDay(12) }).expect(201);
    await upload(c, v.id, { type: 'CARTE_GRISE', dateExpiration: isoDay(900) }).expect(201);

    const list = await api(app, c.token).get(`/vehicles/${v.id}/documents`).expect(200);
    expect(
      Object.fromEntries(
        list.body.map((d: { type: string; status: string }) => [d.type, d.status]),
      ),
    ).toEqual({
      VIGNETTE: 'EXPIRE',
      ASSURANCE: 'EXPIRANT_BIENTOT',
      CARTE_GRISE: 'VALIDE',
    });

    const expired = await api(app, c.token).get('/documents?status=EXPIRE').expect(200);
    expect(expired.body.data.map((d: { type: string }) => d.type)).toEqual(['VIGNETTE']);
    const byType = await api(app, c.token).get('/documents?type=ASSURANCE').expect(200);
    expect(byType.body.meta.total).toBe(1);
  });

  it("remplace le fichier et supprime l'ancien du stockage", async () => {
    const created = await upload(
      a,
      vehicleId,
      { type: 'VISITE_TECHNIQUE', dateExpiration: isoDay(200) },
      [PDF, 'vt.pdf', 'application/pdf'],
    ).expect(201);
    const oldKey = await keyOf(created.body.id);

    const res = await api(app, a.token)
      .patch(`/documents/${created.body.id}`)
      .field('dateExpiration', isoDay(565))
      .attach('fichier', PNG, { filename: 'vt.png', contentType: 'image/png' })
      .expect(200);
    expect(res.body).toMatchObject({ fileType: 'png', hasFile: true });

    const newKey = await keyOf(created.body.id);
    expect(newKey).not.toBe(oldKey);
    expect(existsSync(storedPath(oldKey!))).toBe(false);
    expect(existsSync(storedPath(newKey!))).toBe(true);
  });

  it('supprime le document et son fichier', async () => {
    const created = await upload(a, vehicleId, { type: 'ASSURANCE', dateExpiration: isoDay(50) }, [
      PDF,
      'a.pdf',
      'application/pdf',
    ]).expect(201);
    const key = await keyOf(created.body.id);
    await api(app, a.token).delete(`/documents/${created.body.id}`).expect(204);
    expect(existsSync(storedPath(key!))).toBe(false);
  });

  it('supprimer un véhicule supprime aussi les fichiers de ses documents', async () => {
    const v = await createVehicle(app, a);
    const created = await upload(a, v.id, { type: 'ASSURANCE', dateExpiration: isoDay(50) }, [
      PDF,
      'a.pdf',
      'application/pdf',
    ]).expect(201);
    const key = await keyOf(created.body.id);
    await api(app, a.token).delete(`/vehicles/${v.id}`).expect(204);
    expect(existsSync(storedPath(key!))).toBe(false);
  });

  describe('isolation et droits', () => {
    let documentOfA: string;

    beforeAll(async () => {
      const res = await upload(a, vehicleId, { type: 'ASSURANCE', dateExpiration: isoDay(100) }, [
        PDF,
        'a.pdf',
        'application/pdf',
      ]).expect(201);
      documentOfA = res.body.id;
    });

    it('B ne peut ni lire, ni télécharger, ni modifier, ni supprimer un document de A', async () => {
      const asB = api(app, b.token);
      await asB.get(`/documents/${documentOfA}`).expect(404);
      await asB.get(`/documents/${documentOfA}/file`).expect(404);
      await asB.patch(`/documents/${documentOfA}`).field('type', 'VIGNETTE').expect(404);
      await asB.delete(`/documents/${documentOfA}`).expect(404);
      await asB.get(`/vehicles/${vehicleId}/documents`).expect(404);
      const list = await asB.get('/documents?limit=100').expect(200);
      expect(list.body.data.some((d: { id: string }) => d.id === documentOfA)).toBe(false);
    });

    it('B ne peut pas ajouter un document sur le véhicule de A', async () => {
      await upload(b, vehicleId, { type: 'ASSURANCE', dateExpiration: isoDay(100) }).expect(404);
    });

    it('un chauffeur ne peut ni lire ni modifier les documents', async () => {
      const driver = await createDriver(app, a);
      const asDriver = api(app, driver.token);
      await asDriver.get(`/vehicles/${vehicleId}/documents`).expect(403);
      await asDriver.get(`/documents/${documentOfA}/file`).expect(403);
      await asDriver.patch(`/documents/${documentOfA}`).field('type', 'VIGNETTE').expect(403);
      await asDriver.delete(`/documents/${documentOfA}`).expect(403);
    });
  });
});
