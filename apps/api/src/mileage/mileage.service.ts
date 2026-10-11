import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { AppException, badRequest, forbidden } from '../common/errors/app.exception';
import { paginated, skipTake, type PaginationQueryDto } from '../common/pagination';
import { assignedVehicleOf } from '../assignments/assigned-vehicle';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import type { CreateMileageDto } from './dto/mileage.dto';
import { mileageViolation } from './mileage-rules';
import { recordOdometer } from './odometer';

@Injectable()
export class MileageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
  ) {}

  /**
   * Enregistre un relevé :
   * 1. chauffeur : vérifie son affectation (le véhicule est celui qui lui est affecté) ;
   * 2. vérifie que le véhicule appartient à l'entreprise ;
   * 3. vérifie que le kilométrage n'est pas inférieur au compteur ;
   * 4-5. crée le relevé et fait avancer le compteur, dans une transaction.
   */
  async create(user: AuthUser, companyId: string, dto: CreateMileageDto) {
    const isDriver = user.role === 'CHAUFFEUR';
    const vehicleId = isDriver
      ? await assignedVehicleOf(
          this.prisma,
          user,
          companyId,
          dto.vehicleId,
          'Vous ne pouvez saisir que le kilométrage du véhicule qui vous est affecté',
        )
      : dto.vehicleId;
    if (!vehicleId) throw badRequest('Indiquez le véhicule concerné (vehicleId)');

    const vehicle = await this.vehicles.getOwned(companyId, vehicleId);
    const last = await this.prisma.mileageLog.findFirst({
      where: { vehicleId, companyId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    const now = new Date();
    const date = dto.date ? new Date(dto.date) : now;
    const violation = mileageViolation({
      kilometrage: dto.kilometrage,
      date,
      current: vehicle.kilometrageActuel,
      lastReadingDate: last?.date ?? null,
      now,
    });
    if (violation)
      throw new AppException(HttpStatus.BAD_REQUEST, violation.error, violation.message);

    const saved = await this.prisma.$transaction((tx) =>
      recordOdometer(tx, {
        companyId,
        vehicleId,
        kilometrage: dto.kilometrage,
        date,
        source: isDriver ? 'APP' : 'MANUEL',
        driverId: isDriver ? user.driverId : null,
      }),
    );
    if (!saved) {
      // Un relevé plus élevé a été enregistré entre la vérification et l'écriture.
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'MILEAGE_TOO_LOW',
        'Un relevé plus élevé vient d’être enregistré pour ce véhicule : vérifiez le compteur',
      );
    }
    return saved;
  }

  async findForVehicle(companyId: string, vehicleId: string, query: PaginationQueryDto) {
    await this.vehicles.getOwned(companyId, vehicleId);
    const where = { companyId, vehicleId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mileageLog.findMany({
        where,
        include: { driver: { select: { id: true, nom: true, prenom: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        ...skipTake(query),
      }),
      this.prisma.mileageLog.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  /** Relevés saisis par le chauffeur connecté. */
  async findForDriver(user: AuthUser, companyId: string, query: PaginationQueryDto) {
    if (!user.driverId) throw forbidden("Ce compte n'est lié à aucune fiche chauffeur");
    const where = { companyId, driverId: user.driverId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mileageLog.findMany({
        where,
        include: {
          vehicle: { select: { id: true, immatriculation: true, marque: true, modele: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        ...skipTake(query),
      }),
      this.prisma.mileageLog.count({ where }),
    ]);
    return paginated(items, total, query);
  }
}
