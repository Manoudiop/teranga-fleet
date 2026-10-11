-- CreateTable
CREATE TABLE "vehicle_locations" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_locations_companyId_recordedAt_idx" ON "vehicle_locations"("companyId", "recordedAt");

-- CreateIndex
CREATE INDEX "vehicle_locations_driverId_recordedAt_idx" ON "vehicle_locations"("driverId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_locations_vehicleId_recordedAt_key" ON "vehicle_locations"("vehicleId", "recordedAt");

-- AddForeignKey
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "vehicles"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_driverId_companyId_fkey" FOREIGN KEY ("driverId", "companyId") REFERENCES "drivers"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Contraintes d'intégrité (ajout manuel)
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_coordinates_check"
  CHECK (
    "latitude" BETWEEN -90 AND 90
    AND "longitude" BETWEEN -180 AND 180
    AND ("accuracy" IS NULL OR "accuracy" >= 0)
    AND ("speed" IS NULL OR "speed" >= 0)
    AND ("heading" IS NULL OR "heading" BETWEEN 0 AND 360)
  );
