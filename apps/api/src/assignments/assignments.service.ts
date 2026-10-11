import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, conflict, notFound } from '../common/errors/app.exception';
import { paginated, skipTake } from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assignmentViolation, periodViolation, type RuleViolation } from './assignment-rules';
import type {
  AssignmentQueryDto,
  CreateAssignmentDto,
  EndAssignmentDto,
  UpdateAssignmentDto,
} from './dto/assignment.dto';

const include = {
  vehicle: {
    select: { id: true, immatriculation: true, marque: true, modele: true, statut: true },
  },
  driver: { select: { id: true, nom: true, prenom: true, contact: true } },
} satisfies Prisma.AssignmentInclude;

type AssignmentWithRelations = Prisma.AssignmentGetPayload<{ include: typeof include }>;

const toResponse = (a: AssignmentWithRelations) => ({ ...a, active: a.dateFin === null });

function fail(violation: RuleViolation): never {
  const status = violation.error === 'BAD_REQUEST' ? HttpStatus.BAD_REQUEST : HttpStatus.CONFLICT;
  throw new AppException(status, violation.error, violation.message);
}

const formatDate = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateAssignmentDto) {
    const now = new Date();
    const dateDebut = dto.dateDebut ? new Date(dto.dateDebut) : now;

    const [vehicle, driver] = await Promise.all([
      this.prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, companyId },
        include: {
          assignments: {
            where: { dateFin: null },
            include: { driver: { select: { prenom: true, nom: true } } },
          },
        },
      }),
      this.prisma.driver.findFirst({
        where: { id: dto.driverId, companyId },
        include: {
          assignments: {
            where: { dateFin: null },
            include: { vehicle: { select: { immatriculation: true } } },
          },
        },
      }),
    ]);
    if (!vehicle) throw notFound('Véhicule introuvable');
    if (!driver) throw notFound('Chauffeur introuvable');

    const vehicleActive = vehicle.assignments[0];
    const driverActive = driver.assignments[0];
    const violation = assignmentViolation({
      vehicle,
      driver,
      vehicleActiveWith: vehicleActive
        ? `${vehicleActive.driver.prenom} ${vehicleActive.driver.nom}`
        : null,
      driverActiveOn: driverActive?.vehicle.immatriculation ?? null,
      dateDebut,
      now,
    });
    if (violation) fail(violation);

    await this.assertNoOverlap(companyId, dto.vehicleId, dto.driverId, dateDebut, null);

    try {
      const created = await this.prisma.assignment.create({
        data: { companyId, vehicleId: dto.vehicleId, driverId: dto.driverId, dateDebut },
        include,
      });
      return toResponse(created);
    } catch (error) {
      // Index uniques partiels : une autre affectation vient d'être créée en parallèle.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict('Ce véhicule ou ce chauffeur vient d’être affecté. Rechargez la page.');
      }
      throw error;
    }
  }

  async findAll(companyId: string, query: AssignmentQueryDto) {
    const where: Prisma.AssignmentWhereInput = {
      companyId,
      ...(query.active !== undefined && { dateFin: query.active ? null : { not: null } }),
      ...(query.vehicleId && { vehicleId: query.vehicleId }),
      ...(query.driverId && { driverId: query.driverId }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.assignment.findMany({
        where,
        include,
        orderBy: { dateDebut: 'desc' },
        ...skipTake(query),
      }),
      this.prisma.assignment.count({ where }),
    ]);
    return paginated(items.map(toResponse), total, query);
  }

  async findOne(companyId: string, id: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, companyId },
      include,
    });
    if (!assignment) throw notFound('Affectation introuvable');
    return toResponse(assignment);
  }

  /** Corrige les dates d'une affectation (ou termine celle en cours). */
  async update(companyId: string, id: string, dto: UpdateAssignmentDto) {
    const current = await this.findOne(companyId, id);
    const dateDebut = dto.dateDebut ? new Date(dto.dateDebut) : current.dateDebut;
    const dateFin = dto.dateFin ? new Date(dto.dateFin) : current.dateFin;

    const violation = periodViolation(dateDebut, dateFin, new Date());
    if (violation) fail(violation);
    await this.assertNoOverlap(
      companyId,
      current.vehicle.id,
      current.driver.id,
      dateDebut,
      dateFin,
      id,
    );

    const updated = await this.prisma.assignment.update({
      where: { id },
      data: { dateDebut, dateFin },
      include,
    });
    return toResponse(updated);
  }

  async end(companyId: string, id: string, dto: EndAssignmentDto) {
    const current = await this.findOne(companyId, id);
    if (current.dateFin) {
      throw conflict(
        `Cette affectation est déjà terminée depuis le ${formatDate(current.dateFin)}`,
      );
    }
    const dateFin = dto.dateFin ? new Date(dto.dateFin) : new Date();
    const violation = periodViolation(current.dateDebut, dateFin, new Date());
    if (violation) fail(violation);

    const updated = await this.prisma.assignment.update({
      where: { id },
      data: { dateFin },
      include,
    });
    return toResponse(updated);
  }

  /**
   * Refuse une période qui chevauche une autre affectation du même véhicule ou
   * du même chauffeur (une période en cours s'étend jusqu'à aujourd'hui).
   */
  private async assertNoOverlap(
    companyId: string,
    vehicleId: string,
    driverId: string,
    dateDebut: Date,
    dateFin: Date | null,
    excludeId?: string,
  ) {
    const overlapping = await this.prisma.assignment.findFirst({
      where: {
        companyId,
        ...(excludeId && { id: { not: excludeId } }),
        ...(dateFin && { dateDebut: { lt: dateFin } }),
        AND: [
          { OR: [{ vehicleId }, { driverId }] },
          { OR: [{ dateFin: null }, { dateFin: { gt: dateDebut } }] },
        ],
      },
      include,
    });
    if (overlapping) {
      const period = `du ${formatDate(overlapping.dateDebut)} ${
        overlapping.dateFin ? `au ${formatDate(overlapping.dateFin)}` : "à aujourd'hui"
      }`;
      throw conflict(
        `Cette période chevauche l'affectation de ${overlapping.driver.prenom} ${overlapping.driver.nom} sur ${overlapping.vehicle.immatriculation} ${period}`,
      );
    }
  }
}
