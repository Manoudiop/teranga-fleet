import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assignedVehicleOf } from '../assignments/assigned-vehicle';
import type { AuthUser } from '../auth/auth-user';
import { badRequest } from '../common/errors/app.exception';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import type { CreateLocationsDto, TrackQueryDto } from './dto/location.dto';
import { filterLocationPoints } from './location-rules';

const HOUR_MS = 60 * 60 * 1000;
/** Ancienneté maximale d'un point envoyé en différé par le téléphone. */
const MAX_POINT_AGE_DAYS = 7;
/** Fenêtre maximale d'un tracé consulté en une fois. */
const MAX_TRACK_DAYS = 7;
const MAX_TRACK_POINTS = 5_000;
const PURGE_INTERVAL_MS = 6 * HOUR_MS;

interface LatestRow {
  vehicleId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: Date;
}

@Injectable()
export class LocationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LocationsService.name);
  private readonly retentionDays: number;
  private readonly purgeEnabled: boolean;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    config: ConfigService<Env, true>,
  ) {
    this.retentionDays = config.get('LOCATION_RETENTION_DAYS', { infer: true });
    this.purgeEnabled = config.get('NODE_ENV', { infer: true }) !== 'test';
  }

  /** Purge périodique des positions au-delà de la durée de conservation. */
  onModuleInit() {
    if (!this.purgeEnabled) return;
    this.timer = setInterval(() => void this.purgeExpired(), PURGE_INTERVAL_MS);
    this.timer.unref();
    setTimeout(() => void this.purgeExpired(), 60_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async purgeExpired(now = new Date()): Promise<number> {
    const before = new Date(now.getTime() - this.retentionDays * 24 * HOUR_MS);
    try {
      const { count } = await this.prisma.vehicleLocation.deleteMany({
        where: { recordedAt: { lt: before } },
      });
      if (count > 0)
        this.logger.log(`${count} position(s) de plus de ${this.retentionDays} jours supprimée(s)`);
      return count;
    } catch (error) {
      this.logger.error(`Purge des positions impossible : ${String(error)}`);
      return 0;
    }
  }

  /**
   * Positions envoyées par le chauffeur : rattachées au véhicule qui lui est
   * affecté. Les points invalides sont écartés, les doublons ignorés.
   */
  async record(user: AuthUser, companyId: string, dto: CreateLocationsDto) {
    const vehicleId = await assignedVehicleOf(
      this.prisma,
      user,
      companyId,
      undefined,
      'Aucun véhicule ne vous est affecté',
    );
    const assignment = await this.prisma.assignment.findFirstOrThrow({
      where: { companyId, driverId: user.driverId!, dateFin: null },
      select: { dateDebut: true },
    });

    const points = dto.points.map((p) => ({ ...p, recordedAt: new Date(p.recordedAt) }));
    const { accepted, rejected } = filterLocationPoints(points, {
      now: new Date(),
      assignmentStart: assignment.dateDebut,
      maxAgeDays: MAX_POINT_AGE_DAYS,
    });

    const { count } = accepted.length
      ? await this.prisma.vehicleLocation.createMany({
          data: accepted.map((p) => ({
            companyId,
            vehicleId,
            driverId: user.driverId!,
            latitude: p.latitude,
            longitude: p.longitude,
            accuracy: p.accuracy,
            speed: p.speed,
            heading: p.heading,
            recordedAt: p.recordedAt,
          })),
          skipDuplicates: true,
        })
      : { count: 0 };

    return { accepted: count, duplicates: accepted.length - count, rejected };
  }

  /** Dernière position connue de chaque véhicule de la flotte. */
  async latest(companyId: string, maxAgeHours: number) {
    const since = new Date(Date.now() - maxAgeHours * HOUR_MS);
    // DISTINCT ON : un seul point, le plus récent, par véhicule (index vehicleId + recordedAt).
    const rows = await this.prisma.$queryRaw<LatestRow[]>`
      SELECT DISTINCT ON ("vehicleId")
        "vehicleId", "driverId", latitude, longitude, accuracy, speed, heading, "recordedAt"
      FROM vehicle_locations
      WHERE "companyId" = ${companyId}::uuid AND "recordedAt" >= ${since}
      ORDER BY "vehicleId", "recordedAt" DESC
    `;
    if (!rows.length) return [];

    const [vehicles, drivers] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: { companyId, id: { in: rows.map((r) => r.vehicleId) } },
        select: { id: true, immatriculation: true, marque: true, modele: true, statut: true },
      }),
      this.prisma.driver.findMany({
        where: { companyId, id: { in: rows.map((r) => r.driverId) } },
        select: { id: true, nom: true, prenom: true, contact: true },
      }),
    ]);
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const driverById = new Map(drivers.map((d) => [d.id, d]));

    return rows
      .map(({ vehicleId, driverId, ...position }) => ({
        ...position,
        vehicle: vehicleById.get(vehicleId)!,
        driver: driverById.get(driverId) ?? null,
      }))
      .sort((a, b) => a.vehicle.immatriculation.localeCompare(b.vehicle.immatriculation));
  }

  /** Tracé d'un véhicule sur une période (24 h par défaut, 7 jours maximum). */
  async track(companyId: string, vehicleId: string, query: TrackQueryDto) {
    await this.vehicles.getOwned(companyId, vehicleId);
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 24 * HOUR_MS);
    if (from >= to) throw badRequest('Le début de la période doit précéder sa fin');
    if (to.getTime() - from.getTime() > MAX_TRACK_DAYS * 24 * HOUR_MS) {
      throw badRequest(`La période ne peut pas dépasser ${MAX_TRACK_DAYS} jours`);
    }

    const points = await this.prisma.vehicleLocation.findMany({
      where: { companyId, vehicleId, recordedAt: { gte: from, lte: to } },
      select: {
        latitude: true,
        longitude: true,
        accuracy: true,
        speed: true,
        heading: true,
        recordedAt: true,
        driverId: true,
      },
      orderBy: { recordedAt: 'asc' },
      take: MAX_TRACK_POINTS,
    });
    return { from, to, truncated: points.length === MAX_TRACK_POINTS, points };
  }
}
