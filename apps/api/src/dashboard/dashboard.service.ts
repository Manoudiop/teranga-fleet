import { Injectable } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import { PrismaService } from '../prisma/prisma.service';

/** Premier jour du mois (UTC, qui est aussi l'heure du Sénégal) décalé de `offset` mois. */
function monthStart(now: Date, offset = 0): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
}

const monthKey = (d: Date) => d.toISOString().slice(0, 7);

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  async summary(companyId: string) {
    const now = new Date();
    const [vehiclesByStatus, drivers, activeDrivers, openIncidents, monthCost, alerts] =
      await Promise.all([
        this.prisma.vehicle.groupBy({
          by: ['statut'],
          where: { companyId },
          _count: { _all: true },
          orderBy: { statut: 'asc' },
        }),
        this.prisma.driver.count({ where: { companyId } }),
        this.prisma.driver.count({ where: { companyId, statut: 'ACTIF' } }),
        this.prisma.incident.count({ where: { companyId, status: { not: 'RESOLVED' } } }),
        this.prisma.maintenanceRecord.aggregate({
          where: { companyId, date: { gte: monthStart(now), lt: monthStart(now, 1) } },
          _sum: { cout: true },
        }),
        // Mêmes règles que la page Alertes : les chiffres concordent toujours.
        this.alerts.compute(companyId, {}),
      ]);

    const byStatus = Object.fromEntries(
      vehiclesByStatus.map((row) => [row.statut, row._count._all]),
    );
    const countAlerts = (type: string) => alerts.filter((a) => a.type === type).length;

    return {
      vehicles: {
        total: Object.values(byStatus).reduce((sum, n) => sum + n, 0),
        active: byStatus.ACTIVE ?? 0,
        maintenance: byStatus.MAINTENANCE ?? 0,
        horsService: byStatus.HORS_SERVICE ?? 0,
      },
      drivers: { total: drivers, active: activeDrivers },
      documents: {
        expired: countAlerts('DOCUMENT_EXPIRED'),
        expiringSoon: countAlerts('DOCUMENT_EXPIRING'),
      },
      licenses: {
        expired: countAlerts('LICENSE_EXPIRED'),
        expiringSoon: countAlerts('LICENSE_EXPIRING'),
      },
      maintenance: {
        overdue: countAlerts('MAINTENANCE_OVERDUE'),
        dueSoon: countAlerts('MAINTENANCE_DUE'),
        /** Coût des entretiens du mois en cours, en francs CFA. */
        costThisMonth: monthCost._sum.cout ?? 0,
      },
      incidents: { open: openIncidents },
      alerts: {
        critical: alerts.filter((a) => a.severity === 'CRITICAL').length,
        warning: alerts.filter((a) => a.severity === 'WARNING').length,
        total: alerts.length,
      },
    };
  }

  /** Coûts d'entretien par mois sur les `months` derniers mois (mois en cours inclus). */
  async maintenanceCosts(companyId: string, months: number) {
    const now = new Date();
    const from = monthStart(now, -(months - 1));
    const records = await this.prisma.maintenanceRecord.findMany({
      where: { companyId, date: { gte: from, lt: monthStart(now, 1) } },
      select: { date: true, cout: true },
    });

    const series = new Map<string, { month: string; total: number; count: number }>();
    for (let i = 0; i < months; i++) {
      const key = monthKey(monthStart(now, -(months - 1) + i));
      series.set(key, { month: key, total: 0, count: 0 });
    }
    for (const record of records) {
      const entry = series.get(monthKey(record.date));
      if (entry) {
        entry.total += record.cout;
        entry.count += 1;
      }
    }
    const data = [...series.values()];
    return { months: data, total: data.reduce((sum, m) => sum + m.total, 0) };
  }
}
