import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Alert } from '@teranga-fleet/shared';
import type { AuthUser } from '../auth/auth-user';
import { forbidden } from '../common/errors/app.exception';
import type { Env } from '../config/env.validation';
import { loadMaintenanceDue } from '../maintenance/load-maintenance-due';
import { PrismaService } from '../prisma/prisma.service';
import { buildAlerts } from './build-alerts';
import type { AlertQueryDto } from './dto/alert.dto';

/** Périmètre des alertes : toute la flotte, ou des véhicules / chauffeurs précis. */
interface Scope {
  vehicleIds?: string[];
  driverIds?: string[];
}

@Injectable()
export class AlertsService {
  private readonly thresholdDays: number;
  private readonly kmMargin: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.thresholdDays = config.get('ALERT_THRESHOLD_DAYS', { infer: true });
    this.kmMargin = config.get('MAINTENANCE_KM_MARGIN', { infer: true });
  }

  /**
   * Gestionnaire : alertes de toute la flotte.
   * Chauffeur : alertes de son véhicule affecté et de son permis.
   */
  async list(user: AuthUser, companyId: string, query: AlertQueryDto): Promise<Alert[]> {
    const scope = user.role === 'CHAUFFEUR' ? await this.driverScope(user, companyId) : {};
    const alerts = await this.compute(companyId, scope);
    return alerts.filter(
      (a) =>
        (!query.vehicleId || a.vehicleId === query.vehicleId) &&
        (!query.severity || a.severity === query.severity) &&
        (!query.type || a.type === query.type),
    );
  }

  /** Véhicules qui ont au moins une alerte (filtre de la liste des véhicules). */
  async vehicleIdsWithAlerts(companyId: string): Promise<string[]> {
    const alerts = await this.compute(companyId, {});
    return [...new Set(alerts.map((a) => a.vehicleId).filter((id): id is string => id !== null))];
  }

  async compute(companyId: string, scope: Scope): Promise<Alert[]> {
    const vehicleFilter = scope.vehicleIds ? { in: scope.vehicleIds } : undefined;
    const [vehicles, documents, drivers, incidents] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where: { companyId, ...(vehicleFilter && { id: vehicleFilter }) },
        select: { id: true, immatriculation: true, statut: true },
      }),
      this.prisma.document.findMany({
        where: { companyId, ...(vehicleFilter && { vehicleId: vehicleFilter }) },
        select: { id: true, vehicleId: true, type: true, dateExpiration: true },
      }),
      this.prisma.driver.findMany({
        where: {
          companyId,
          // Le permis d'un chauffeur inactif ou suspendu n'est pas une urgence.
          statut: 'ACTIF',
          ...(scope.driverIds && { id: { in: scope.driverIds } }),
        },
        select: { id: true, nom: true, prenom: true, dateExpirationPermis: true },
      }),
      this.prisma.incident.findMany({
        where: {
          companyId,
          status: { not: 'RESOLVED' },
          severity: { in: ['HIGH', 'CRITICAL'] },
          ...(vehicleFilter && { vehicleId: vehicleFilter }),
        },
        select: {
          id: true,
          vehicleId: true,
          driverId: true,
          severity: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);
    const maintenanceDue = await loadMaintenanceDue(
      this.prisma,
      companyId,
      { thresholdDays: this.thresholdDays, kmMargin: this.kmMargin },
      scope.vehicleIds,
    );

    return buildAlerts(
      { vehicles, documents, drivers, incidents, maintenanceDue },
      { today: new Date(), thresholdDays: this.thresholdDays },
    );
  }

  private async driverScope(user: AuthUser, companyId: string): Promise<Scope> {
    if (!user.driverId) throw forbidden("Ce compte n'est lié à aucune fiche chauffeur");
    const assignment = await this.prisma.assignment.findFirst({
      where: { companyId, driverId: user.driverId, dateFin: null },
      select: { vehicleId: true },
    });
    return { vehicleIds: assignment ? [assignment.vehicleId] : [], driverIds: [user.driverId] };
  }
}
