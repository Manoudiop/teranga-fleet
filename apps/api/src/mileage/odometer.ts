import type { Prisma } from '../generated/prisma/client';
import type { MileageSource } from '../generated/prisma/enums';

export interface OdometerReading {
  companyId: string;
  vehicleId: string;
  kilometrage: number;
  date: Date;
  source: MileageSource;
  driverId?: string | null;
}

/**
 * Enregistre un relevé et fait avancer le compteur du véhicule, dans la
 * transaction fournie. La mise à jour est conditionnelle (kilometrageActuel
 * <= nouveau relevé) : même avec deux saisies simultanées, le compteur ne
 * peut jamais redescendre. Renvoie false, sans rien écrire, si le relevé est
 * inférieur au kilométrage actuel.
 */
export async function recordOdometer(
  tx: Prisma.TransactionClient,
  reading: OdometerReading,
): Promise<boolean> {
  const updated = await tx.vehicle.updateMany({
    where: {
      id: reading.vehicleId,
      companyId: reading.companyId,
      kilometrageActuel: { lte: reading.kilometrage },
    },
    data: { kilometrageActuel: reading.kilometrage },
  });
  if (updated.count === 0) return false;

  await tx.mileageLog.create({
    data: {
      companyId: reading.companyId,
      vehicleId: reading.vehicleId,
      driverId: reading.driverId ?? null,
      kilometrage: reading.kilometrage,
      date: reading.date,
      source: reading.source,
    },
  });
  return true;
}
