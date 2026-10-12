import { Injectable } from '@nestjs/common';
import { notFound } from '../common/errors/app.exception';
import { paginated, skipTake, type PaginationQueryDto } from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { accountSelect } from '../accounts/accounts.service';
import { PrismaService } from '../prisma/prisma.service';

const companyCounts = {
  _count: { select: { users: true, vehicles: true, drivers: true, incidents: true } },
} satisfies Prisma.CompanyInclude;

/** Administration de la plateforme (rôle ADMIN) : vue transverse sur toutes les entreprises. */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const [companies, users, vehicles, drivers, openIncidents, usersByRole, recentCompanies] =
      await this.prisma.$transaction([
        this.prisma.company.count(),
        this.prisma.user.count(),
        this.prisma.vehicle.count(),
        this.prisma.driver.count(),
        this.prisma.incident.count({ where: { status: { not: 'RESOLVED' } } }),
        this.prisma.user.groupBy({
          by: ['role'],
          _count: { _all: true },
          orderBy: { role: 'asc' },
        }),
        this.prisma.company.count({
          where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
        }),
      ]);
    return {
      companies: { total: companies, createdLast30Days: recentCompanies },
      users: {
        total: users,
        byRole: Object.fromEntries(usersByRole.map((row) => [row.role, row._count._all])),
      },
      vehicles,
      drivers,
      openIncidents,
    };
  }

  async companies(query: PaginationQueryDto & { search?: string }) {
    const where: Prisma.CompanyWhereInput = query.search
      ? {
          OR: [
            { nom: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        include: companyCounts,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
      }),
      this.prisma.company.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async company(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        ...companyCounts,
        users: {
          select: accountSelect,
          orderBy: [{ role: 'asc' }, { nom: 'asc' }],
        },
      },
    });
    if (!company) throw notFound('Entreprise introuvable');
    return company;
  }

  /** Suspend ou réactive une entreprise (abonnement impayé, résiliation...). */
  async setCompanySuspended(id: string, suspended: boolean) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { suspendedAt: true },
    });
    if (!company) throw notFound('Entreprise introuvable');
    return this.prisma.company.update({
      where: { id },
      data: { suspendedAt: suspended ? (company.suspendedAt ?? new Date()) : null },
      select: { id: true, nom: true, suspendedAt: true },
    });
  }

  async assertCompanyExists(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!company) throw notFound('Entreprise introuvable');
  }
}
