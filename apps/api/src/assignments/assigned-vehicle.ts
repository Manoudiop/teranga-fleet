import { HttpStatus } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { AppException, forbidden } from '../common/errors/app.exception';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Véhicule actuellement affecté au chauffeur connecté. Si le client désigne
 * un autre véhicule, l'action est refusée (403) avec `refusalMessage`.
 */
export async function assignedVehicleOf(
  prisma: PrismaService,
  user: AuthUser,
  companyId: string,
  requestedVehicleId: string | undefined,
  refusalMessage: string,
): Promise<string> {
  if (!user.driverId) throw forbidden("Ce compte n'est lié à aucune fiche chauffeur");
  const assignment = await prisma.assignment.findFirst({
    where: { companyId, driverId: user.driverId, dateFin: null },
    select: { vehicleId: true },
  });
  if (!assignment) {
    throw new AppException(
      HttpStatus.CONFLICT,
      'NO_ACTIVE_ASSIGNMENT',
      'Aucun véhicule ne vous est affecté : contactez votre gestionnaire',
    );
  }
  if (requestedVehicleId && requestedVehicleId !== assignment.vehicleId) {
    throw forbidden(refusalMessage);
  }
  return assignment.vehicleId;
}
