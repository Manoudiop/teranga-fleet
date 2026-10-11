import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getExpiryStatus } from '@teranga-fleet/shared';
import { PasswordService } from '../auth/password.service';
import { toDate } from '../common/dates';
import { conflict, forbidden, notFound } from '../common/errors/app.exception';
import { expiryDateFilter } from '../common/expiry-filter';
import { paginated, skipTake } from '../common/pagination';
import type { Env } from '../config/env.validation';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateDriverDto,
  DriverAccountDto,
  DriverQueryDto,
  UpdateDriverDto,
} from './dto/driver.dto';

const driverInclude = {
  user: { select: { id: true, email: true } },
  assignments: {
    where: { dateFin: null },
    select: {
      id: true,
      dateDebut: true,
      vehicle: {
        select: {
          id: true,
          immatriculation: true,
          marque: true,
          modele: true,
          statut: true,
          kilometrageActuel: true,
        },
      },
    },
  },
} satisfies Prisma.DriverInclude;

type DriverWithRelations = Prisma.DriverGetPayload<{ include: typeof driverInclude }>;

@Injectable()
export class DriversService {
  private readonly thresholdDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    config: ConfigService<Env, true>,
  ) {
    this.thresholdDays = config.get('ALERT_THRESHOLD_DAYS', { infer: true });
  }

  async create(companyId: string, dto: CreateDriverDto) {
    const { compte, ...data } = dto;
    await this.assertPermisAvailable(companyId, data.numeroPermis);
    if (compte) await this.assertEmailAvailable(compte.email);
    const passwordHash = compte ? await this.passwords.hash(compte.password) : null;

    const driver = await this.prisma.$transaction(async (tx) => {
      const user = compte
        ? await tx.user.create({
            data: {
              nom: `${data.prenom} ${data.nom}`,
              email: compte.email,
              password: passwordHash!,
              role: 'CHAUFFEUR',
              companyId,
            },
            select: { id: true },
          })
        : null;
      return tx.driver.create({
        data: {
          ...data,
          dateExpirationPermis: toDate(data.dateExpirationPermis),
          companyId,
          userId: user?.id,
        },
      });
    });
    return this.findOne(companyId, driver.id);
  }

  async findAll(companyId: string, query: DriverQueryDto) {
    const where: Prisma.DriverWhereInput = {
      companyId,
      ...(query.statut && { statut: query.statut }),
      ...(query.permis && {
        dateExpirationPermis: expiryDateFilter(query.permis, this.thresholdDays),
      }),
      ...(query.search && {
        OR: ['nom', 'prenom', 'numeroPermis', 'contact'].map((field) => ({
          [field]: { contains: query.search, mode: 'insensitive' },
        })),
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({
        where,
        include: driverInclude,
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        ...skipTake(query),
      }),
      this.prisma.driver.count({ where }),
    ]);
    return paginated(
      items.map((d) => this.toResponse(d)),
      total,
      query,
    );
  }

  async findOne(companyId: string, id: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id, companyId },
      include: driverInclude,
    });
    if (!driver) throw notFound('Chauffeur introuvable');

    const history = await this.prisma.assignment.findMany({
      where: { driverId: id, companyId },
      orderBy: { dateDebut: 'desc' },
      take: 20,
      select: {
        id: true,
        dateDebut: true,
        dateFin: true,
        vehicle: { select: { id: true, immatriculation: true, marque: true, modele: true } },
      },
    });
    return { ...this.toResponse(driver), assignments: history };
  }

  async update(companyId: string, id: string, dto: UpdateDriverDto) {
    const driver = await this.findOne(companyId, id);
    if (dto.numeroPermis && dto.numeroPermis !== driver.numeroPermis) {
      await this.assertPermisAvailable(companyId, dto.numeroPermis);
    }
    if (dto.statut && dto.statut !== 'ACTIF' && driver.currentVehicle) {
      throw conflict(
        `Terminez d'abord l'affectation en cours (${driver.currentVehicle.immatriculation}) avant de changer le statut du chauffeur`,
      );
    }
    await this.prisma.driver.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.dateExpirationPermis && { dateExpirationPermis: toDate(dto.dateExpirationPermis) }),
      },
    });
    return this.findOne(companyId, id);
  }

  /** Supprime un chauffeur sans historique, ainsi que son compte mobile. */
  async remove(companyId: string, id: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id, companyId },
      include: { _count: { select: { assignments: true, mileageLogs: true, incidents: true } } },
    });
    if (!driver) throw notFound('Chauffeur introuvable');

    const { assignments, mileageLogs, incidents } = driver._count;
    if (assignments + mileageLogs + incidents > 0) {
      throw conflict(
        'Ce chauffeur a un historique (affectations, relevés ou incidents) : passez plutôt son statut à INACTIF',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.driver.delete({ where: { id } });
      if (driver.userId) await tx.user.delete({ where: { id: driver.userId } });
    });
  }

  /** Crée le compte mobile du chauffeur, ou met à jour son email et son mot de passe. */
  async setAccount(companyId: string, id: string, dto: DriverAccountDto) {
    const driver = await this.prisma.driver.findFirst({
      where: { id, companyId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!driver) throw notFound('Chauffeur introuvable');
    if (dto.email !== driver.user?.email) await this.assertEmailAvailable(dto.email);

    const password = await this.passwords.hash(dto.password);
    if (driver.user) {
      await this.prisma.user.update({
        where: { id: driver.user.id },
        data: { email: dto.email, password },
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            nom: `${driver.prenom} ${driver.nom}`,
            email: dto.email,
            password,
            role: 'CHAUFFEUR',
            companyId,
          },
          select: { id: true },
        });
        await tx.driver.update({ where: { id }, data: { userId: user.id } });
      });
    }
    return this.findOne(companyId, id);
  }

  /** Profil du chauffeur connecté (application mobile). */
  async me(driverId: string | null, companyId: string) {
    if (!driverId) throw forbidden("Ce compte n'est lié à aucune fiche chauffeur");
    const { assignments: _history, ...driver } = await this.findOne(companyId, driverId);
    return driver;
  }

  private toResponse({ assignments, user, ...driver }: DriverWithRelations) {
    const current = assignments[0];
    return {
      ...driver,
      permisStatus: getExpiryStatus(driver.dateExpirationPermis, this.thresholdDays),
      account: user ? { email: user.email } : null,
      currentAssignment: current ? { id: current.id, dateDebut: current.dateDebut } : null,
      currentVehicle: current?.vehicle ?? null,
    };
  }

  private async assertPermisAvailable(companyId: string, numeroPermis: string) {
    const existing = await this.prisma.driver.findUnique({
      where: { companyId_numeroPermis: { companyId, numeroPermis } },
      select: { id: true },
    });
    if (existing) throw conflict(`Un chauffeur avec le permis ${numeroPermis} existe déjà`);
  }

  private async assertEmailAvailable(email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw conflict('Un compte existe déjà avec cet email');
  }
}
