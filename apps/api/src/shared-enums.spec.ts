import * as shared from '@teranga-fleet/shared';
import * as prisma from './generated/prisma/enums';

/**
 * Les enums du package partagé (utilisés par le web et le mobile) doivent
 * rester identiques à ceux du schéma Prisma. Ce test casse dès qu'un côté
 * est modifié sans l'autre.
 */
describe('Enums partagés / Prisma', () => {
  const pairs = {
    Role: [shared.Role, prisma.Role],
    VehicleStatus: [shared.VehicleStatus, prisma.VehicleStatus],
    DriverStatus: [shared.DriverStatus, prisma.DriverStatus],
    DocumentType: [shared.DocumentType, prisma.DocumentType],
    MileageSource: [shared.MileageSource, prisma.MileageSource],
    IncidentType: [shared.IncidentType, prisma.IncidentType],
    IncidentSeverity: [shared.IncidentSeverity, prisma.IncidentSeverity],
    IncidentStatus: [shared.IncidentStatus, prisma.IncidentStatus],
  };

  it.each(Object.entries(pairs))('%s est synchronisé', (_name, [sharedEnum, prismaEnum]) => {
    expect(sharedEnum).toEqual(prismaEnum);
  });
});
