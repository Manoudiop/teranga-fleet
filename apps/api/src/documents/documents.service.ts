import { Injectable, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getExpiryStatus } from '@teranga-fleet/shared';
import { toDate } from '../common/dates';
import { badRequest, notFound } from '../common/errors/app.exception';
import { expiryDateFilter } from '../common/expiry-filter';
import { paginated, skipTake } from '../common/pagination';
import type { Env } from '../config/env.validation';
import type { Document, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileStoreService } from '../storage/file-store.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import type { CreateDocumentDto, DocumentQueryDto, UpdateDocumentDto } from './dto/document.dto';

const vehicleSelect = { select: { id: true, immatriculation: true, marque: true, modele: true } };

@Injectable()
export class DocumentsService {
  private readonly thresholdDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileStoreService,
    private readonly vehicles: VehiclesService,
    config: ConfigService<Env, true>,
  ) {
    this.thresholdDays = config.get('ALERT_THRESHOLD_DAYS', { infer: true });
  }

  async create(
    companyId: string,
    vehicleId: string,
    dto: CreateDocumentDto,
    file?: Express.Multer.File,
  ) {
    await this.vehicles.getOwned(companyId, vehicleId);
    this.assertDates(dto.dateEmission, dto.dateExpiration);

    const key = file ? await this.store(companyId, file) : null;
    try {
      const document = await this.prisma.document.create({
        data: {
          companyId,
          vehicleId,
          type: dto.type,
          dateEmission: toDate(dto.dateEmission),
          dateExpiration: toDate(dto.dateExpiration),
          fichierUrl: key,
        },
        include: { vehicle: vehicleSelect },
      });
      return this.toResponse(document);
    } catch (error) {
      if (key) await this.files.deleteQuietly(key);
      throw error;
    }
  }

  async findAll(companyId: string, query: DocumentQueryDto) {
    const where: Prisma.DocumentWhereInput = {
      companyId,
      ...(query.type && { type: query.type }),
      ...(query.vehicleId && { vehicleId: query.vehicleId }),
      ...(query.status && { dateExpiration: expiryDateFilter(query.status, this.thresholdDays) }),
      ...(query.search && {
        vehicle: { immatriculation: { contains: query.search, mode: 'insensitive' } },
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        include: { vehicle: vehicleSelect },
        orderBy: [{ dateExpiration: 'asc' }, { type: 'asc' }],
        ...skipTake(query),
      }),
      this.prisma.document.count({ where }),
    ]);
    return paginated(
      items.map((d) => this.toResponse(d)),
      total,
      query,
    );
  }

  async findForVehicle(companyId: string, vehicleId: string) {
    await this.vehicles.getOwned(companyId, vehicleId);
    const documents = await this.prisma.document.findMany({
      where: { companyId, vehicleId },
      orderBy: [{ type: 'asc' }, { dateExpiration: 'desc' }],
    });
    return documents.map((d) => this.toResponse(d));
  }

  async findOne(companyId: string, id: string) {
    return this.toResponse(await this.getOwned(companyId, id, true));
  }

  async update(companyId: string, id: string, dto: UpdateDocumentDto, file?: Express.Multer.File) {
    const current = await this.getOwned(companyId, id);
    const dateEmission =
      dto.dateEmission ?? current.dateEmission?.toISOString().slice(0, 10) ?? undefined;
    const dateExpiration = dto.dateExpiration ?? current.dateExpiration.toISOString().slice(0, 10);
    this.assertDates(dateEmission, dateExpiration);

    const key = file ? await this.store(companyId, file) : undefined;
    try {
      const document = await this.prisma.document.update({
        where: { id },
        data: {
          ...(dto.type && { type: dto.type }),
          ...(dto.dateEmission && { dateEmission: toDate(dto.dateEmission) }),
          ...(dto.dateExpiration && { dateExpiration: toDate(dto.dateExpiration) }),
          ...(key && { fichierUrl: key }),
        },
        include: { vehicle: vehicleSelect },
      });
      // Le nouveau fichier est enregistré : l'ancien peut être supprimé.
      if (key && current.fichierUrl) await this.files.deleteQuietly(current.fichierUrl);
      return this.toResponse(document);
    } catch (error) {
      if (key) await this.files.deleteQuietly(key);
      throw error;
    }
  }

  async remove(companyId: string, id: string) {
    const document = await this.getOwned(companyId, id);
    await this.prisma.document.delete({ where: { id } });
    if (document.fichierUrl) await this.files.deleteQuietly(document.fichierUrl);
  }

  async download(companyId: string, id: string): Promise<StreamableFile> {
    const document = await this.getOwned(companyId, id, true);
    if (!document.fichierUrl) throw notFound("Ce document n'a pas de fichier joint");
    return this.files.download(
      document.fichierUrl,
      `${document.type.toLowerCase()}-${document.vehicle.immatriculation}`,
    );
  }

  private async getOwned(companyId: string, id: string): Promise<Document>;
  private async getOwned(
    companyId: string,
    id: string,
    withVehicle: true,
  ): Promise<Prisma.DocumentGetPayload<{ include: { vehicle: typeof vehicleSelect } }>>;
  private async getOwned(companyId: string, id: string, withVehicle = false) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId },
      include: withVehicle ? { vehicle: vehicleSelect } : undefined,
    });
    if (!document) throw notFound('Document introuvable');
    return document;
  }

  private store(companyId: string, file: Express.Multer.File): Promise<string> {
    return this.files.store(companyId, 'documents', file, ['pdf', 'jpg', 'png']);
  }

  private assertDates(dateEmission: string | undefined, dateExpiration: string) {
    if (dateEmission && dateExpiration < dateEmission) {
      throw badRequest("La date d'expiration doit être postérieure à la date d'émission");
    }
  }

  /** La clé de stockage n'est jamais exposée : le fichier passe par GET /documents/:id/file. */
  private toResponse<T extends Document>({ fichierUrl, ...document }: T) {
    return {
      ...document,
      status: getExpiryStatus(document.dateExpiration, this.thresholdDays),
      hasFile: fichierUrl !== null,
      fileType: fichierUrl ? (fichierUrl.split('.').pop() ?? null) : null,
    };
  }
}
