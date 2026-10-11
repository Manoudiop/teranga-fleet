import type { PrismaService } from '../prisma/prisma.service';
import { computeMaintenanceDue, type DueOptions, type MaintenanceDue } from './maintenance-due';

/**
 * Charge les entretiens et les compteurs de l'entreprise puis calcule les
 * échéances (dépassées d'abord, puis par proximité). Fonction hors Nest :
 * utilisée par la maintenance et par les alertes sans dépendance circulaire.
 */
export async function loadMaintenanceDue(
  prisma: PrismaService,
  companyId: string,
  options: Omit<DueOptions, 'today'>,
  vehicleIds?: string[],
) {
  const vehicleFilter = vehicleIds ? { in: vehicleIds } : undefined;
  const [records, vehicles] = await prisma.$transaction([
    prisma.maintenanceRecord.findMany({
      where: { companyId, ...(vehicleFilter && { vehicleId: vehicleFilter }) },
      select: {
        id: true,
        vehicleId: true,
        type: true,
        date: true,
        createdAt: true,
        prochainEntretienKm: true,
        prochainEntretienDate: true,
      },
    }),
    prisma.vehicle.findMany({
      where: { companyId, ...(vehicleFilter && { id: vehicleFilter }) },
      select: {
        id: true,
        immatriculation: true,
        marque: true,
        modele: true,
        kilometrageActuel: true,
      },
    }),
  ]);

  const byId = new Map(vehicles.map((v) => [v.id, v]));
  return computeMaintenanceDue(records, new Map(vehicles.map((v) => [v.id, v.kilometrageActuel])), {
    ...options,
    today: new Date(),
  })
    .sort(compareUrgency)
    .map((item) => ({ ...item, vehicle: byId.get(item.vehicleId)! }));
}

export type LoadedMaintenanceDue = Awaited<ReturnType<typeof loadMaintenanceDue>>[number];

/** Dépassés avant « à prévoir », puis par proximité de l'échéance (1 jour ≈ 100 km). */
function compareUrgency(a: MaintenanceDue, b: MaintenanceDue): number {
  if (a.level !== b.level) return a.level === 'OVERDUE' ? -1 : 1;
  const score = (d: MaintenanceDue) =>
    Math.min(d.date?.daysRemaining ?? Infinity, d.km ? d.km.remaining / 100 : Infinity);
  return score(a) - score(b);
}
