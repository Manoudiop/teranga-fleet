import { INestApplication } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { App } from 'supertest/types';
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

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const PDF = Buffer.from('%PDF-1.7\n%%EOF\n', 'latin1');

describe('Incidents (e2e)', () => {
  let app: INestApplication<App>;
  let a: TestCompany;
  let b: TestCompany;
  let vehicle: { id: string; immatriculation: string };
  let driver: TestDriver;
  let otherDriver: TestDriver;

  beforeAll(async () => {
    app = await createTestApp();
    a = await registerCompany(app, 'Entreprise A');
    b = await registerCompany(app, 'Entreprise B');
    vehicle = await createVehicle(app, a, { immatriculation: 'DK-INC-1' });
    driver = await createDriver(app, a, { prenom: 'Ousmane' });
    otherDriver = await createDriver(app, a);
    await api(app, a.token)
      .post('/assignments')
      .send({ vehicleId: vehicle.id, driverId: driver.id })
      .expect(201);
    const otherVehicle = await createVehicle(app, a);
    await api(app, a.token)
      .post('/assignments')
      .send({ vehicleId: otherVehicle.id, driverId: otherDriver.id })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const declare = (
    who: { token: string },
    fields: Record<string, string>,
    photo?: [Buffer, string, string],
  ) => {
    const req = api(app, who.token).post('/incidents');
    for (const [k, v] of Object.entries(fields)) void req.field(k, v);
    if (photo) void req.attach('photo', photo[0], { filename: photo[1], contentType: photo[2] });
    return req;
  };

  const storedKey = async (id: string) =>
    (await prismaOf(app).incident.findUniqueOrThrow({ where: { id } })).photoUrl;

  describe('chauffeur', () => {
    it('signale un incident avec photo sur son véhicule affecté', async () => {
      const res = await declare(
        driver,
        { type: 'PNEU', severity: 'LOW', description: 'Crevaison sur la VDN' },
        [JPG, 'photo.jpg', 'image/jpeg'],
      ).expect(201);

      expect(res.body).toMatchObject({
        type: 'PNEU',
        severity: 'LOW',
        status: 'OPEN',
        hasPhoto: true,
        vehicle: { id: vehicle.id, immatriculation: 'DK-INC-1' },
        driver: { id: driver.id, prenom: 'Ousmane' },
        resolvedAt: null,
      });
      expect(res.body.photoUrl).toBeUndefined();
      expect(await storedKey(res.body.id)).toMatch(
        new RegExp(`^companies/${a.companyId}/incidents/.+\\.jpg$`),
      );
    });

    it('ne peut pas signaler sur un autre véhicule que le sien', async () => {
      const other = await createVehicle(app, a);
      const res = await declare(driver, {
        vehicleId: other.id,
        type: 'PANNE',
        severity: 'HIGH',
        description: 'x',
      }).expect(403);
      expect(res.body.message).toMatch(/véhicule qui vous est affecté/);
    });

    it('ne peut pas se faire passer pour un autre chauffeur (driverId ignoré)', async () => {
      const res = await declare(driver, {
        driverId: otherDriver.id,
        type: 'AUTRE',
        severity: 'MEDIUM',
        description: 'Voyant moteur',
      }).expect(201);
      expect(res.body.driver.id).toBe(driver.id);
    });

    it('refuse une photo qui n’est pas une image JPG/PNG', async () => {
      await declare(driver, { type: 'AUTRE', severity: 'LOW', description: 'x' }, [
        PDF,
        'x.jpg',
        'image/jpeg',
      ]).expect(415);
    });

    it('ne voit que ses incidents', async () => {
      await declare(otherDriver, {
        type: 'ACCIDENT',
        severity: 'CRITICAL',
        description: 'Accrochage',
      }).expect(201);
      const mine = await api(app, driver.token).get('/incidents?limit=100').expect(200);
      expect(mine.body.data.length).toBeGreaterThan(0);
      expect(
        mine.body.data.every((i: { driver: { id: string } }) => i.driver.id === driver.id),
      ).toBe(true);

      const ofOther = (
        await api(app, a.token).get(`/incidents?driverId=${otherDriver.id}`).expect(200)
      ).body.data[0];
      await api(app, driver.token).get(`/incidents/${ofOther.id}`).expect(404);
      await api(app, driver.token).get(`/incidents/${ofOther.id}/photo`).expect(404);
      // Le filtre driverId ne permet pas de contourner la restriction.
      const bypass = await api(app, driver.token)
        .get(`/incidents?driverId=${otherDriver.id}`)
        .expect(200);
      expect(
        bypass.body.data.every((i: { driver: { id: string } }) => i.driver.id === driver.id),
      ).toBe(true);
    });

    it('ajoute une photo à son incident, mais ne peut pas le traiter', async () => {
      const created = await declare(driver, {
        type: 'PANNE',
        severity: 'MEDIUM',
        description: 'Ne démarre plus',
      }).expect(201);
      expect(created.body.hasPhoto).toBe(false);

      const res = await api(app, driver.token)
        .post(`/incidents/${created.body.id}/photo`)
        .attach('photo', PNG, { filename: 'p.png', contentType: 'image/png' })
        .expect(201);
      expect(res.body.hasPhoto).toBe(true);

      await api(app, driver.token)
        .patch(`/incidents/${created.body.id}`)
        .send({ status: 'RESOLVED' })
        .expect(403);
    });

    it('ne peut rien signaler sans affectation', async () => {
      const free = await createDriver(app, a);
      const res = await declare(free, { type: 'AUTRE', severity: 'LOW', description: 'x' }).expect(
        409,
      );
      expect(res.body.error).toBe('NO_ACTIVE_ASSIGNMENT');
    });
  });

  describe('gestionnaire', () => {
    it('consulte, traite puis clôture un incident', async () => {
      const created = await declare(driver, {
        type: 'PROBLEME_MECANIQUE',
        severity: 'MEDIUM',
        description: 'Embrayage',
      }).expect(201);
      const id = created.body.id;

      const inProgress = await api(app, a.token)
        .patch(`/incidents/${id}`)
        .send({ status: 'IN_PROGRESS', severity: 'HIGH', notesGestionnaire: 'Envoyé au garage' })
        .expect(200);
      expect(inProgress.body).toMatchObject({
        status: 'IN_PROGRESS',
        severity: 'HIGH',
        resolvedAt: null,
      });

      const resolved = await api(app, a.token)
        .patch(`/incidents/${id}`)
        .send({ status: 'RESOLVED' })
        .expect(200);
      expect(resolved.body.resolvedAt).toEqual(expect.any(String));
      expect(resolved.body.notesGestionnaire).toBe('Envoyé au garage');

      // Une fois clôturé, le chauffeur ne peut plus changer la photo.
      await api(app, driver.token)
        .post(`/incidents/${id}/photo`)
        .attach('photo', JPG, { filename: 'x.jpg', contentType: 'image/jpeg' })
        .expect(409);

      const reopened = await api(app, a.token)
        .patch(`/incidents/${id}`)
        .send({ status: 'OPEN' })
        .expect(200);
      expect(reopened.body.resolvedAt).toBeNull();
    });

    it('déclare un incident sur un véhicule de la flotte et filtre la liste', async () => {
      const v = await createVehicle(app, a);
      await declare(a, {
        vehicleId: v.id,
        type: 'ACCIDENT',
        severity: 'CRITICAL',
        description: 'Choc parking',
      }).expect(201);
      await declare(a, { type: 'ACCIDENT', severity: 'CRITICAL', description: 'x' }).expect(400);

      const critical = await api(app, a.token)
        .get(`/incidents?vehicleId=${v.id}&severity=CRITICAL`)
        .expect(200);
      expect(critical.body.meta.total).toBe(1);
      expect(critical.body.data[0].driver).toBeNull();
      const open = await api(app, a.token).get('/incidents?status=OPEN&limit=100').expect(200);
      expect(open.body.data.every((i: { status: string }) => i.status === 'OPEN')).toBe(true);
    });

    it("remplace la photo et supprime l'ancienne du stockage", async () => {
      const created = await declare(driver, { type: 'PNEU', severity: 'LOW', description: 'x' }, [
        JPG,
        'a.jpg',
        'image/jpeg',
      ]).expect(201);
      const oldKey = await storedKey(created.body.id);
      await api(app, a.token)
        .post(`/incidents/${created.body.id}/photo`)
        .attach('photo', PNG, { filename: 'b.png', contentType: 'image/png' })
        .expect(201);
      expect(existsSync(resolve(process.env.UPLOAD_DIR!, oldKey!))).toBe(false);

      const photo = await api(app, a.token).get(`/incidents/${created.body.id}/photo`).expect(200);
      expect(photo.headers['content-type']).toBe('image/png');
    });
  });

  it('isole les incidents entre entreprises', async () => {
    const created = await declare(driver, { type: 'AUTRE', severity: 'LOW', description: 'x' }, [
      JPG,
      'a.jpg',
      'image/jpeg',
    ]).expect(201);
    const asB = api(app, b.token);
    await asB.get(`/incidents/${created.body.id}`).expect(404);
    await asB.get(`/incidents/${created.body.id}/photo`).expect(404);
    await asB.patch(`/incidents/${created.body.id}`).send({ status: 'RESOLVED' }).expect(404);
    await asB
      .post(`/incidents/${created.body.id}/photo`)
      .attach('photo', PNG, { filename: 'b.png', contentType: 'image/png' })
      .expect(404);
    await declare(b, {
      vehicleId: vehicle.id,
      type: 'AUTRE',
      severity: 'LOW',
      description: 'x',
    }).expect(404);
    const list = await asB.get('/incidents?limit=100').expect(200);
    expect(list.body.data.some((i: { id: string }) => i.id === created.body.id)).toBe(false);
  });
});
