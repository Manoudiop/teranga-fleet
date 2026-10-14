-- AlterTable
ALTER TABLE "users" ADD COLUMN     "alertDigest" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "alert_digests" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "alertIds" TEXT[],
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_digests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alert_digests_companyId_day_key" ON "alert_digests"("companyId", "day");

-- AddForeignKey
ALTER TABLE "alert_digests" ADD CONSTRAINT "alert_digests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
