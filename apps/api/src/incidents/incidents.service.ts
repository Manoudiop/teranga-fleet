import { HttpStatus, Injectable, StreamableFile } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { AppException, badRequest, forbidden, notFound } from '../common/errors/app.exception';
import { paginated, skipTake } from '../common/pagination';
import type { Incident, Prisma } from '../generated/prisma/client';
import { assignedVehicleOf } from '../assignments/assigned-vehicle';
import { PrismaService } from '../prisma/prisma.service';
import { FileStoreService } from '../storage/file-store.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import type { CreateIncidentDto, IncidentQueryDto, UpdateIncidentDto } from './dto/incident.dto';

const include = {
  vehicle: { select: { id: true, immatriculation: true, marque: true, modele: true } },
  driver: { select: { id: true, nom: true, prenom: true, contact: true } },
} satisfies Prisma.IncidentInclude;

const PHOTO_TYPES = ['jpg', 'png'] as const;

/** La clé de stockage n'est jamais exposée : la photo passe par GET /incidents/:id/photo. */
function toResponse<T extends Incident>({ photoUrl, ...incident }: T) {
  return { ...incident, hasPhoto: photoUrl !== null };
}

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly files: FileStoreService,
  ) {}

  async create(
    user: AuthUser,
    companyId: string,
    dto: CreateIncidentDto,
    photo?: Express.Multer.File,
  ) {
    let vehicleId: string;
    let driverId: string | null;

    if (user.role === 'CHAUFFEUR') {
      // Le chauffeur ne déclare que sur le véhicule qui lui est affecté, en son nom.
      vehicleId = await assignedVehicleOf(
        this.prisma,
        user,
        companyId,
        dto.vehicleId,
        'Vous ne pouvez signaler un incident que sur le véhicule qui vous est affecté',
      );
      driverId = user.driverId;
    } else {
      if (!dto.vehicleId) throw badRequest('Indiquez le véhicule concerné (vehicleId)');
      vehicleId = (await this.vehicles.getOwned(companyId, dto.vehicleId)).id;
      driverId = dto.driverId ? await this.ownedDriverId(companyId, dto.driverId) : null;
    }

    const key = photo
      ? await this.files.store(companyId, 'incidents', photo, [...PHOTO_TYPES])
      : null;
    try {
      const incident = await this.prisma.incident.create({
        data: {
          companyId,
          vehicleId,
          driverId,
          type: dto.type,
          severity: dto.severity,
          description: dto.description,
          photoUrl: key,
        },
        include,
      });
      return toResponse(incident);
    } catch (error) {
      await this.files.deleteQuietly(key);
      throw error;
    }
  }

  async findAll(user: AuthUser, companyId: string, query: IncidentQueryDto) {
    const where: Prisma.IncidentWhereInput = {
      companyId,
      ...this.visibleTo(user),
      ...(query.status && { status: query.status }),
      ...(query.severity && { severity: query.severity }),
      ...(query.type && { type: query.type }),
      ...(query.vehicleId && { vehicleId: query.vehicleId }),
      ...(query.driverId && user.role !== 'CHAUFFEUR' && { driverId: query.driverId }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
      }),
      this.prisma.incident.count({ where }),
    ]);
    return paginated(items.map(toResponse), total, query);
  }

  async findOne(user: AuthUser, companyId: string, id: string) {
    return toResponse(await this.getVisible(user, companyId, id));
  }

  /** Traitement par le gestionnaire : statut, gravité, notes, clôture. */
  async update(companyId: string, id: string, dto: UpdateIncidentDto) {
    const current = await this.prisma.incident.findFirst({ where: { id, companyId } });
    if (!current) throw notFound('Incident introuvable');

    const status = dto.status ?? current.status;
    const resolvedAt = status === 'RESOLVED' ? (current.resolvedAt ?? new Date()) : null;

    const incident = await this.prisma.incident.update({
      where: { id },
      data: { ...dto, resolvedAt },
      include,
    });
    return toResponse(incident);
  }

  /** Ajoute ou remplace la photo d'un incident. */
  async setPhoto(user: AuthUser, companyId: string, id: string, photo?: Express.Multer.File) {
    if (!photo) throw badRequest('Ajoutez une photo (champ « photo »)');
    const current = await this.getVisible(user, companyId, id);
    if (user.role === 'CHAUFFEUR' && current.status === 'RESOLVED') {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'Cet incident est clôturé : la photo ne peut plus être modifiée',
      );
    }

    const key = await this.files.store(companyId, 'incidents', photo, [...PHOTO_TYPES]);
    try {
      const incident = await this.prisma.incident.update({
        where: { id },
        data: { photoUrl: key },
        include,
      });
      await this.files.deleteQuietly(current.photoUrl);
      return toResponse(incident);
    } catch (error) {
      await this.files.deleteQuietly(key);
      throw error;
    }
  }

  async photo(user: AuthUser, companyId: string, id: string): Promise<StreamableFile> {
    const incident = await this.getVisible(user, companyId, id);
    if (!incident.photoUrl) throw notFound("Cet incident n'a pas de photo");
    return this.files.download(incident.photoUrl, `incident-${incident.vehicle.immatriculation}`);
  }

  /** Un chauffeur ne voit que les incidents qu'il a déclarés ou qui le concernent. */
  private visibleTo(user: AuthUser): Prisma.IncidentWhereInput {
    if (user.role !== 'CHAUFFEUR') return {};
    if (!user.driverId) throw forbidden("Ce compte n'est lié à aucune fiche chauffeur");
    return { driverId: user.driverId };
  }

  private async getVisible(user: AuthUser, companyId: string, id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, companyId, ...this.visibleTo(user) },
      include,
    });
    if (!incident) throw notFound('Incident introuvable');
    return incident;
  }

  private async ownedDriverId(companyId: string, driverId: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, companyId },
      select: { id: true },
    });
    if (!driver) throw notFound('Chauffeur introuvable');
    return driver.id;
  }
}
