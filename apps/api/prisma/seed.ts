/**
 * Seed de développement : une entreprise de transport dakaroise avec son
 * gestionnaire, deux chauffeurs, trois véhicules et leur historique.
 *
 * - Idempotent : l'entreprise de démonstration est supprimée puis recréée.
 * - Les dates sont relatives au jour du seed, pour que les alertes (document
 *   expiré, permis bientôt expiré, entretien dépassé...) existent toujours.
 * - Aucun mot de passe n'est versionné : il vient de SEED_PASSWORD, sinon il
 *   est généré aléatoirement et affiché une seule fois dans la console.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { prismaClientOptions } from '../src/prisma/prisma.options';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Le seed de développement ne doit jamais être lancé en production.');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquante (voir apps/api/.env.example).');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  ...prismaClientOptions,
});

const COMPANY_EMAIL = 'contact@teranga-logistique.example';
const ADMIN_EMAIL = 'admin@teranga-fleet.example';

/** Date du jour décalée de `offset` jours, à minuit UTC. */
function day(offset: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

/** Date du jour décalée de `offset` jours, à l'heure donnée (UTC). */
function at(offset: number, hour: number): Date {
  const d = day(offset);
  d.setUTCHours(hour);
  return d;
}

async function main() {
  const providedPassword = process.env.SEED_PASSWORD?.trim();
  const password = providedPassword || randomBytes(9).toString('base64url');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  // Remise à zéro des données de démonstration (cascade sur toute la flotte).
  await prisma.company.deleteMany({ where: { email: COMPANY_EMAIL } });
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });

  await prisma.user.create({
    data: {
      nom: 'Administrateur Plateforme',
      email: ADMIN_EMAIL,
      password: passwordHash,
      role: 'ADMIN',
    },
  });

  const company = await prisma.company.create({
    data: {
      nom: 'Teranga Logistique SARL',
      email: COMPANY_EMAIL,
      telephone: '+221 33 820 45 10',
      adresse: 'Zone industrielle, Route de Rufisque, Dakar',
    },
  });
  const companyId = company.id;

  await prisma.user.create({
    data: {
      nom: 'Ibrahima Fall',
      email: 'gestionnaire@teranga-logistique.example',
      password: passwordHash,
      role: 'GESTIONNAIRE',
      companyId,
    },
  });

  // --- Chauffeurs, chacun avec son compte mobile -----------------------------
  const createDriverAccount = (nom: string, email: string) =>
    prisma.user.create({
      data: { nom, email, password: passwordHash, role: 'CHAUFFEUR', companyId },
    });

  const moussa = await prisma.driver.create({
    data: {
      nom: 'Diop',
      prenom: 'Moussa',
      contact: '+221 77 412 58 63',
      numeroPermis: 'SN-DK-2014-118734',
      // Permis qui expire bientôt : doit remonter dans les alertes.
      dateExpirationPermis: day(21),
      companyId,
      userId: (await createDriverAccount('Moussa Diop', 'moussa.diop@teranga-logistique.example'))
        .id,
    },
  });

  const aminata = await prisma.driver.create({
    data: {
      nom: 'Sow',
      prenom: 'Aminata',
      contact: '+221 76 905 21 47',
      numeroPermis: 'SN-TH-2018-042591',
      dateExpirationPermis: day(900),
      companyId,
      userId: (await createDriverAccount('Aminata Sow', 'aminata.sow@teranga-logistique.example'))
        .id,
    },
  });

  // --- Véhicules --------------------------------------------------------------
  const hilux = await prisma.vehicle.create({
    data: {
      immatriculation: 'DK-4521-AB',
      marque: 'Toyota',
      modele: 'Hilux',
      annee: 2019,
      type: 'Pick-up',
      dateAcquisition: new Date('2019-06-14'),
      statut: 'ACTIVE',
      kilometrageActuel: 128_450,
      companyId,
    },
  });

  const master = await prisma.vehicle.create({
    data: {
      immatriculation: 'DK-7810-BC',
      marque: 'Renault',
      modele: 'Master',
      annee: 2021,
      type: 'Utilitaire',
      dateAcquisition: new Date('2021-03-02'),
      statut: 'ACTIVE',
      kilometrageActuel: 64_200,
      companyId,
    },
  });

  const h1 = await prisma.vehicle.create({
    data: {
      immatriculation: 'TH-2310-A',
      marque: 'Hyundai',
      modele: 'H1',
      annee: 2016,
      type: 'Minibus',
      dateAcquisition: new Date('2017-01-20'),
      statut: 'MAINTENANCE',
      kilometrageActuel: 214_900,
      companyId,
    },
  });

  // --- Documents ----------------------------------------------------------------
  // Hilux : assurance qui expire dans 12 jours. Hyundai : vignette expirée.
  const documents: Omit<Prisma.DocumentCreateManyInput, 'companyId'>[] = [
    {
      vehicleId: hilux.id,
      type: 'CARTE_GRISE',
      dateEmission: new Date('2019-06-20'),
      dateExpiration: new Date('2029-06-20'),
    },
    { vehicleId: hilux.id, type: 'ASSURANCE', dateEmission: day(-353), dateExpiration: day(12) },
    {
      vehicleId: hilux.id,
      type: 'VISITE_TECHNIQUE',
      dateEmission: day(-120),
      dateExpiration: day(245),
    },
    { vehicleId: hilux.id, type: 'VIGNETTE', dateEmission: day(-200), dateExpiration: day(165) },

    {
      vehicleId: master.id,
      type: 'CARTE_GRISE',
      dateEmission: new Date('2021-03-10'),
      dateExpiration: new Date('2031-03-10'),
    },
    { vehicleId: master.id, type: 'ASSURANCE', dateEmission: day(-90), dateExpiration: day(275) },
    {
      vehicleId: master.id,
      type: 'VISITE_TECHNIQUE',
      dateEmission: day(-30),
      dateExpiration: day(335),
    },
    { vehicleId: master.id, type: 'VIGNETTE', dateEmission: day(-200), dateExpiration: day(165) },

    {
      vehicleId: h1.id,
      type: 'CARTE_GRISE',
      dateEmission: new Date('2017-01-25'),
      dateExpiration: new Date('2027-01-25'),
    },
    { vehicleId: h1.id, type: 'ASSURANCE', dateEmission: day(-300), dateExpiration: day(65) },
    {
      vehicleId: h1.id,
      type: 'VISITE_TECHNIQUE',
      dateEmission: day(-340),
      dateExpiration: day(25),
    },
    { vehicleId: h1.id, type: 'VIGNETTE', dateEmission: day(-380), dateExpiration: day(-15) },
  ];
  await prisma.document.createMany({ data: documents.map((doc) => ({ ...doc, companyId })) });

  // --- Entretiens (coûts en francs CFA) ----------------------------------------
  await prisma.maintenanceRecord.createMany({
    data: [
      // Hilux : prochain entretien à 130 000 km, encore à venir.
      {
        vehicleId: hilux.id,
        type: 'Vidange moteur + filtres',
        date: day(-160),
        kilometrageAuMoment: 115_200,
        cout: 48_000,
        garage: 'Garage Touba Motors, Colobane',
        prochainEntretienKm: 120_200,
      },
      {
        vehicleId: hilux.id,
        type: 'Vidange moteur + filtres',
        date: day(-45),
        kilometrageAuMoment: 120_150,
        cout: 52_000,
        garage: 'Garage Touba Motors, Colobane',
        prochainEntretienKm: 130_000,
        prochainEntretienDate: day(140),
      },
      // Master : révision à prévoir dans 20 jours (alerte date).
      {
        vehicleId: master.id,
        type: 'Remplacement plaquettes de frein',
        date: day(-70),
        kilometrageAuMoment: 58_900,
        cout: 85_000,
        garage: 'Auto Service Pikine',
        notes: 'Disques à surveiller',
        prochainEntretienDate: day(20),
      },
      // Hyundai : révision dépassée (214 900 km > 210 000 km) et embrayage ce mois-ci.
      {
        vehicleId: h1.id,
        type: 'Révision générale',
        date: day(-210),
        kilometrageAuMoment: 200_100,
        cout: 150_000,
        garage: 'Garage Central Thiès',
        prochainEntretienKm: 210_000,
      },
      {
        vehicleId: h1.id,
        type: 'Remplacement embrayage',
        date: day(-2),
        kilometrageAuMoment: 214_900,
        cout: 420_000,
        garage: 'Garage Central Thiès',
        notes: 'Véhicule immobilisé, pièce commandée',
      },
    ].map((record) => ({ ...record, companyId })),
  });

  // --- Affectations ---------------------------------------------------------------
  await prisma.assignment.createMany({
    data: [
      // Ancienne affectation terminée : Moussa conduisait le Hyundai.
      { vehicleId: h1.id, driverId: moussa.id, dateDebut: at(-400, 8), dateFin: at(-120, 18) },
      // Affectations en cours.
      { vehicleId: hilux.id, driverId: moussa.id, dateDebut: at(-119, 8) },
      { vehicleId: master.id, driverId: aminata.id, dateDebut: at(-300, 8) },
    ].map((assignment) => ({ ...assignment, companyId })),
  });

  // --- Relevés kilométriques (le dernier = kilométrage actuel du véhicule) --------
  await prisma.mileageLog.createMany({
    data: [
      {
        vehicleId: hilux.id,
        driverId: moussa.id,
        date: at(-90, 18),
        kilometrage: 118_900,
        source: 'APP' as const,
      },
      {
        vehicleId: hilux.id,
        driverId: moussa.id,
        date: at(-60, 18),
        kilometrage: 121_700,
        source: 'APP' as const,
      },
      {
        vehicleId: hilux.id,
        driverId: moussa.id,
        date: at(-30, 18),
        kilometrage: 124_980,
        source: 'APP' as const,
      },
      {
        vehicleId: hilux.id,
        driverId: moussa.id,
        date: at(-3, 18),
        kilometrage: 128_450,
        source: 'APP' as const,
      },

      {
        vehicleId: master.id,
        driverId: aminata.id,
        date: at(-60, 17),
        kilometrage: 60_150,
        source: 'APP' as const,
      },
      {
        vehicleId: master.id,
        driverId: aminata.id,
        date: at(-30, 17),
        kilometrage: 62_300,
        source: 'APP' as const,
      },
      {
        vehicleId: master.id,
        driverId: null,
        date: at(-1, 9),
        kilometrage: 64_200,
        source: 'MANUEL' as const,
      },

      {
        vehicleId: h1.id,
        driverId: moussa.id,
        date: at(-150, 18),
        kilometrage: 211_400,
        source: 'APP' as const,
      },
      {
        vehicleId: h1.id,
        driverId: null,
        date: at(-2, 10),
        kilometrage: 214_900,
        source: 'MANUEL' as const,
      },
    ].map((log) => ({ ...log, companyId })),
  });

  // --- Incidents ---------------------------------------------------------------------
  await prisma.incident.createMany({
    data: [
      {
        vehicleId: h1.id,
        driverId: moussa.id,
        type: 'PROBLEME_MECANIQUE' as const,
        severity: 'HIGH' as const,
        status: 'IN_PROGRESS' as const,
        description: "L'embrayage patine en côte, impossible de passer la troisième.",
        notesGestionnaire: 'Véhicule envoyé au Garage Central Thiès.',
        createdAt: at(-4, 11),
      },
      {
        vehicleId: hilux.id,
        driverId: moussa.id,
        type: 'PNEU' as const,
        severity: 'LOW' as const,
        status: 'RESOLVED' as const,
        description: 'Crevaison pneu arrière droit sur la VDN.',
        notesGestionnaire: 'Pneu remplacé par la roue de secours puis réparé.',
        resolvedAt: at(-24, 16),
        createdAt: at(-25, 9),
      },
      {
        vehicleId: master.id,
        driverId: aminata.id,
        type: 'AUTRE' as const,
        severity: 'MEDIUM' as const,
        status: 'OPEN' as const,
        description: 'Voyant moteur allumé par intermittence depuis ce matin.',
        createdAt: at(-1, 8),
      },
    ].map((incident) => ({ ...incident, companyId })),
  });

  const counts = {
    entreprises: await prisma.company.count({ where: { id: companyId } }),
    utilisateurs: await prisma.user.count({
      where: { OR: [{ companyId }, { email: ADMIN_EMAIL }] },
    }),
    chauffeurs: await prisma.driver.count({ where: { companyId } }),
    vehicules: await prisma.vehicle.count({ where: { companyId } }),
    documents: await prisma.document.count({ where: { companyId } }),
    entretiens: await prisma.maintenanceRecord.count({ where: { companyId } }),
    affectations: await prisma.assignment.count({ where: { companyId } }),
    releves: await prisma.mileageLog.count({ where: { companyId } }),
    incidents: await prisma.incident.count({ where: { companyId } }),
  };

  console.log('\nSeed terminé :', counts);
  console.log('\nComptes de développement :');
  console.log(`  ADMIN         ${ADMIN_EMAIL}`);
  console.log('  GESTIONNAIRE  gestionnaire@teranga-logistique.example');
  console.log('  CHAUFFEUR     moussa.diop@teranga-logistique.example');
  console.log('  CHAUFFEUR     aminata.sow@teranga-logistique.example');
  console.log(
    providedPassword
      ? '  Mot de passe  celui défini dans SEED_PASSWORD\n'
      : `  Mot de passe  ${password}  (généré, définir SEED_PASSWORD pour le fixer)\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
