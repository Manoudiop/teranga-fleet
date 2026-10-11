import { Injectable } from '@nestjs/common';
import { toDate } from '../common/dates';
import { conflict, notFound } from '../common/errors/app.exception';
import { paginated, skipTake } from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileStoreService } from '../storage/file-store.service';
import type { CreateVehicleDto, UpdateVehicleDto, VehicleQueryDto } from './dto/vehicle.dto';

/** Chauffeur de l'affectation en cours (au plus une, garanti par la base). */
const currentDriverInclude = {
  assignments: {
    where: { dateFin: null },
    select: {
      id: true,
      dateDebut: true,
      driver: { select: { id: true, nom: true, prenom: true, contact: true } },
    },
  },
} satisfies Prisma.VehicleInclude;

type VehicleWithAssignments = Prisma.VehicleGetPayload<{ include: typeof currentDriverInclude }>;

function withCurrentAssignment<T extends VehicleWithAssignments>({ assignments, ...vehicle }: T) {
  const current = assignments[0];
  return {
    ...vehicle,
    currentAssignment: current ? { id: current.id, dateDebut: current.dateDebut } : null,
    currentDriver: current?.driver ?? null,
  };
}

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileStoreService,
  ) {}

  async create(companyId: string, dto: CreateVehicleDto) {
    await this.assertPlateAvailable(companyId, dto.immatriculation);
    const km = dto.kilometrageActuel ?? 0;

    const vehicle = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vehicle.create({
        data: {
          ...dto,
          dateAcquisition: toDate(dto.dateAcquisition),
          kilometrageActuel: km,
          companyId,
        },
      });
      // Relevé initial : l'historique kilométrique commence à la mise en service.
      if (km > 0) {
        await tx.mileageLog.create({
          data: {
            companyId,
            vehicleId: created.id,
            date: new Date(),
            kilometrage: km,
            source: 'MANUEL',
          },
        });
      }
      return created;
    });
    return this.findOne(companyId, vehicle.id);
  }

  /** `idFilter` restreint la liste (ex. véhicules avec ou sans alerte). */
  async findAll(companyId: string, query: VehicleQueryDto, idFilter?: Prisma.StringFilter) {
    const where: Prisma.VehicleWhereInput = {
      companyId,
      ...(query.status && { statut: query.status }),
      ...(idFilter && { id: idFilter }),
      ...(query.search && {
        OR: [
          { immatriculation: { contains: query.search, mode: 'insensitive' } },
          { marque: { contains: query.search, mode: 'insensitive' } },
          { modele: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        include: currentDriverInclude,
        orderBy: { immatriculation: 'asc' },
        ...skipTake(query),
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return paginated(items.map(withCurrentAssignment), total, query);
  }

  async findOne(companyId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, companyId },
      include: {
        ...currentDriverInclude,
        _count: {
          select: {
            documents: true,
            maintenanceRecords: true,
            mileageLogs: true,
            incidents: { where: { status: { not: 'RESOLVED' } } },
          },
        },
      },
    });
    if (!vehicle) throw notFound('Véhicule introuvable');
    const { _count, ...rest } = vehicle;
    return {
      ...withCurrentAssignment(rest),
      counts: {
        documents: _count.documents,
        maintenanceRecords: _count.maintenanceRecords,
        mileageLogs: _count.mileageLogs,
        openIncidents: _count.incidents,
      },
    };
  }

  async update(companyId: string, id: string, dto: UpdateVehicleDto) {
    const vehicle = await this.getOwned(companyId, id);
    if (dto.immatriculation && dto.immatriculation !== vehicle.immatriculation) {
      await this.assertPlateAvailable(companyId, dto.immatriculation);
    }
    await this.prisma.vehicle.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.dateAcquisition !== undefined && { dateAcquisition: toDate(dto.dateAcquisition) }),
      },
    });
    return this.findOne(companyId, id);
  }

  /**
   * Supprime le véhicule et tout son historique (documents, entretiens,
   * affectations, relevés, incidents), puis les fichiers liés du stockage.
   */
  async remove(companyId: string, id: string): Promise<void> {
    await this.getOwned(companyId, id);
    const [documents, incidents] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where: { vehicleId: id, companyId, fichierUrl: { not: null } },
        select: { fichierUrl: true },
      }),
      this.prisma.incident.findMany({
        where: { vehicleId: id, companyId, photoUrl: { not: null } },
        select: { photoUrl: true },
      }),
    ]);
    await this.prisma.vehicle.delete({ where: { id } });

    const keys = [...documents.map((d) => d.fichierUrl), ...incidents.map((i) => i.photoUrl)];
    await Promise.all(keys.map((key) => this.files.deleteQuietly(key)));
  }

  /** Véhicule de l'entreprise, ou 404 (y compris s'il appartient à une autre entreprise). */
  async getOwned(companyId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, companyId } });
    if (!vehicle) throw notFound('Véhicule introuvable');
    return vehicle;
  }

  private async assertPlateAvailable(companyId: string, immatriculation: string) {
    const existing = await this.prisma.vehicle.findUnique({
      where: { companyId_immatriculation: { companyId, immatriculation } },
      select: { id: true },
    });
    if (existing) throw conflict(`Un véhicule immatriculé ${immatriculation} existe déjà`);
  }
}
