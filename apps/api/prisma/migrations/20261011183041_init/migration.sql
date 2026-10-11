-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GESTIONNAIRE', 'CHAUFFEUR');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'HORS_SERVICE');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIF', 'INACTIF', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CARTE_GRISE', 'ASSURANCE', 'VISITE_TECHNIQUE', 'VIGNETTE');

-- CreateEnum
CREATE TYPE "MileageSource" AS ENUM ('MANUEL', 'APP');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('ACCIDENT', 'PANNE', 'PROBLEME_MECANIQUE', 'PNEU', 'AUTRE');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "companyId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "immatriculation" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "modele" TEXT NOT NULL,
    "annee" INTEGER,
    "type" TEXT,
    "dateAcquisition" DATE,
    "statut" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "kilometrageActuel" INTEGER NOT NULL DEFAULT 0,
    "companyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "contact" TEXT,
    "numeroPermis" TEXT NOT NULL,
    "dateExpirationPermis" DATE NOT NULL,
    "statut" "DriverStatus" NOT NULL DEFAULT 'ACTIF',
    "companyId" UUID NOT NULL,
    "userId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "dateEmission" DATE,
    "dateExpiration" DATE NOT NULL,
    "fichierUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kilometrageAuMoment" INTEGER NOT NULL,
    "cout" INTEGER NOT NULL DEFAULT 0,
    "garage" TEXT,
    "notes" TEXT,
    "prochainEntretienKm" INTEGER,
    "prochainEntretienDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mileage_logs" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID,
    "companyId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kilometrage" INTEGER NOT NULL,
    "source" "MileageSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mileage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID,
    "companyId" UUID NOT NULL,
    "type" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "notesGestionnaire" TEXT,
    "photoUrl" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE INDEX "vehicles_companyId_statut_idx" ON "vehicles"("companyId", "statut");

-- CreateIndex
CREATE INDEX "vehicles_immatriculation_idx" ON "vehicles"("immatriculation");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_companyId_immatriculation_key" ON "vehicles"("companyId", "immatriculation");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_id_companyId_key" ON "vehicles"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_userId_key" ON "drivers"("userId");

-- CreateIndex
CREATE INDEX "drivers_companyId_dateExpirationPermis_idx" ON "drivers"("companyId", "dateExpirationPermis");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_companyId_numeroPermis_key" ON "drivers"("companyId", "numeroPermis");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_id_companyId_key" ON "drivers"("id", "companyId");

-- CreateIndex
CREATE INDEX "assignments_companyId_dateFin_idx" ON "assignments"("companyId", "dateFin");

-- CreateIndex
CREATE INDEX "assignments_vehicleId_dateDebut_idx" ON "assignments"("vehicleId", "dateDebut");

-- CreateIndex
CREATE INDEX "assignments_driverId_dateDebut_idx" ON "assignments"("driverId", "dateDebut");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_one_active_per_vehicle" ON "assignments"("vehicleId") WHERE ("dateFin" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "assignments_one_active_per_driver" ON "assignments"("driverId") WHERE ("dateFin" IS NULL);

-- CreateIndex
CREATE INDEX "documents_vehicleId_idx" ON "documents"("vehicleId");

-- CreateIndex
CREATE INDEX "documents_companyId_dateExpiration_idx" ON "documents"("companyId", "dateExpiration");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "maintenance_records_vehicleId_date_idx" ON "maintenance_records"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "maintenance_records_companyId_date_idx" ON "maintenance_records"("companyId", "date");

-- CreateIndex
CREATE INDEX "maintenance_records_prochainEntretienDate_idx" ON "maintenance_records"("prochainEntretienDate");

-- CreateIndex
CREATE INDEX "maintenance_records_prochainEntretienKm_idx" ON "maintenance_records"("prochainEntretienKm");

-- CreateIndex
CREATE INDEX "mileage_logs_vehicleId_date_idx" ON "mileage_logs"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "mileage_logs_driverId_date_idx" ON "mileage_logs"("driverId", "date");

-- CreateIndex
CREATE INDEX "mileage_logs_companyId_idx" ON "mileage_logs"("companyId");

-- CreateIndex
CREATE INDEX "incidents_companyId_status_idx" ON "incidents"("companyId", "status");

-- CreateIndex
CREATE INDEX "incidents_companyId_createdAt_idx" ON "incidents"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "incidents_vehicleId_idx" ON "incidents"("vehicleId");

-- CreateIndex
CREATE INDEX "incidents_driverId_idx" ON "incidents"("driverId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "vehicles"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_driverId_companyId_fkey" FOREIGN KEY ("driverId", "companyId") REFERENCES "drivers"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "vehicles"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "vehicles"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_logs" ADD CONSTRAINT "mileage_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_logs" ADD CONSTRAINT "mileage_logs_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "vehicles"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_logs" ADD CONSTRAINT "mileage_logs_driverId_companyId_fkey" FOREIGN KEY ("driverId", "companyId") REFERENCES "drivers"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "vehicles"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_driverId_companyId_fkey" FOREIGN KEY ("driverId", "companyId") REFERENCES "drivers"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Contraintes d'intégrité non exprimables dans le schéma Prisma (ajout manuel)
-- ---------------------------------------------------------------------------

-- Seul un ADMIN de la plateforme n'est rattaché à aucune entreprise.
ALTER TABLE "users" ADD CONSTRAINT "users_company_matches_role_check"
  CHECK (("role" = 'ADMIN') = ("companyId" IS NULL));

ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_kilometrage_positive_check"
  CHECK ("kilometrageActuel" >= 0);
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_annee_range_check"
  CHECK ("annee" IS NULL OR "annee" BETWEEN 1950 AND 2100);

ALTER TABLE "assignments" ADD CONSTRAINT "assignments_dates_check"
  CHECK ("dateFin" IS NULL OR "dateFin" >= "dateDebut");

ALTER TABLE "documents" ADD CONSTRAINT "documents_dates_check"
  CHECK ("dateEmission" IS NULL OR "dateExpiration" >= "dateEmission");

ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_values_check"
  CHECK (
    "kilometrageAuMoment" >= 0
    AND "cout" >= 0
    AND ("prochainEntretienKm" IS NULL OR "prochainEntretienKm" >= "kilometrageAuMoment")
  );

ALTER TABLE "mileage_logs" ADD CONSTRAINT "mileage_logs_kilometrage_positive_check"
  CHECK ("kilometrage" >= 0);
