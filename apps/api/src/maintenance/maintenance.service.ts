import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { startOfUtcDay, toDate } from '../common/dates';
import { badRequest, notFound } from '../common/errors/app.exception';
import { paginated, skipTake } from '../common/pagination';
import type { Env } from '../config/env.validation';
import type { MaintenanceRecord, Prisma } from '../generated/prisma/client';
import { recordOdometer } from '../mileage/odometer';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import type {
  CreateMaintenanceDto,
  MaintenanceQueryDto,
  UpdateMaintenanceDto,
} from './dto/maintenance.dto';
import { loadMaintenanceDue } from './load-maintenance-due';

const vehicleSelect = {
  select: { id: true, immatriculation: true, marque: true, modele: true, kilometrageActuel: true },
};

type MaintenanceValues = Pick<
  MaintenanceRecord,
  'date' | 'kilometrageAuMoment' | 'prochainEntretienKm' | 'prochainEntretienDate'
>;

@Injectable()
export class MaintenanceService {
  private readonly thresholdDays: number;
  private readonly kmMargin: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    config: ConfigService<Env, true>,
  ) {
    this.thresholdDays = config.get('ALERT_THRESHOLD_DAYS', { infer: true });
    this.kmMargin = config.get('MAINTENANCE_KM_MARGIN', { infer: true });
  }

  async create(companyId: string, dto: CreateMaintenanceDto) {
    const vehicle = await this.vehicles.getOwned(companyId, dto.vehicleId);
    const values = {
      date: toDate(dto.date),
      kilometrageAuMoment: dto.kilometrageAuMoment,
      prochainEntretienKm: dto.prochainEntretienKm ?? null,
      prochainEntretienDate: toDate(dto.prochainEntretienDate) ?? null,
    };
    this.assertCoherent(values);

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceRecord.create({
        data: { ...dto, ...values, companyId },
      });
      // Un entretien plus récent que le dernier relevé fait avancer le compteur.
      if (dto.kilometrageAuMoment > vehicle.kilometrageActuel) {
        await recordOdometer(tx, {
          companyId,
          vehicleId: vehicle.id,
          kilometrage: dto.kilometrageAuMoment,
          date: values.date,
          source: 'MANUEL',
        });
      }
      return created;
    });
    return this.findOne(companyId, record.id);
  }

  async findAll(companyId: string, query: MaintenanceQueryDto) {
    const where: Prisma.MaintenanceRecordWhereInput = {
      companyId,
      ...(query.vehicleId && { vehicleId: query.vehicleId }),
      ...((query.from || query.to) && {
        date: {
          ...(query.from && { gte: toDate(query.from) }),
          ...(query.to && { lte: toDate(query.to) }),
        },
      }),
      ...(query.search && {
        OR: [
          { type: { contains: query.search, mode: 'insensitive' } },
          { garage: { contains: query.search, mode: 'insensitive' } },
          { vehicle: { immatriculation: { contains: query.search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [items, total, sum] = await this.prisma.$transaction([
      this.prisma.maintenanceRecord.findMany({
        where,
        include: { vehicle: vehicleSelect },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        ...skipTake(query),
      }),
      this.prisma.maintenanceRecord.count({ where }),
      this.prisma.maintenanceRecord.aggregate({ where, _sum: { cout: true } }),
    ]);
    return { ...paginated(items, total, query), totalCout: sum._sum.cout ?? 0 };
  }

  async findOne(companyId: string, id: string) {
    const record = await this.prisma.maintenanceRecord.findFirst({
      where: { id, companyId },
      include: { vehicle: vehicleSelect },
    });
    if (!record) throw notFound('Entretien introuvable');
    return record;
  }

  async update(companyId: string, id: string, dto: UpdateMaintenanceDto) {
    const current = await this.findOne(companyId, id);
    const values: MaintenanceValues = {
      date: dto.date ? toDate(dto.date) : current.date,
      kilometrageAuMoment: dto.kilometrageAuMoment ?? current.kilometrageAuMoment,
      prochainEntretienKm:
        dto.prochainEntretienKm !== undefined
          ? dto.prochainEntretienKm
          : current.prochainEntretienKm,
      prochainEntretienDate:
        dto.prochainEntretienDate !== undefined
          ? toDate(dto.prochainEntretienDate)
          : current.prochainEntretienDate,
    };
    this.assertCoherent(values);

    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceRecord.update({ where: { id }, data: { ...dto, ...values } });
      if (values.kilometrageAuMoment > current.vehicle.kilometrageActuel) {
        await recordOdometer(tx, {
          companyId,
          vehicleId: current.vehicleId,
          kilometrage: values.kilometrageAuMoment,
          date: values.date,
          source: 'MANUEL',
        });
      }
    });
    return this.findOne(companyId, id);
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    await this.prisma.maintenanceRecord.delete({ where: { id } });
  }

  /** Entretiens dépassés ou à prévoir, les plus urgents d'abord. */
  due(companyId: string, vehicleId?: string) {
    return loadMaintenanceDue(
      this.prisma,
      companyId,
      { thresholdDays: this.thresholdDays, kmMargin: this.kmMargin },
      vehicleId ? [vehicleId] : undefined,
    );
  }

  private assertCoherent(values: MaintenanceValues) {
    if (values.date > startOfUtcDay(new Date())) {
      throw badRequest("La date de l'entretien ne peut pas être dans le futur");
    }
    if (
      values.prochainEntretienKm !== null &&
      values.prochainEntretienKm <= values.kilometrageAuMoment
    ) {
      throw badRequest(
        'Le kilométrage du prochain entretien doit être supérieur au kilométrage de cet entretien',
      );
    }
    if (values.prochainEntretienDate && values.prochainEntretienDate <= values.date) {
      throw badRequest('La date du prochain entretien doit être postérieure à cet entretien');
    }
  }
}
