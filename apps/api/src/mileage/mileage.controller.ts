import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CompanyId, CurrentUser, Roles } from '../auth/decorators';
import { PaginationQueryDto } from '../common/pagination';
import { UuidPipe } from '../common/uuid.pipe';
import { CreateMileageDto } from './dto/mileage.dto';
import { MileageService } from './mileage.service';

@ApiTags('Mileage')
@ApiBearerAuth()
@Controller()
export class MileageController {
  constructor(private readonly mileage: MileageService) {}

  @Post('mileage')
  @Roles('CHAUFFEUR', 'GESTIONNAIRE')
  @ApiOperation({
    summary: 'Saisit un relevé kilométrique',
    description:
      'Chauffeur : uniquement pour le véhicule qui lui est affecté (source APP). ' +
      'Gestionnaire : pour tout véhicule de la flotte (source MANUEL). ' +
      'Le relevé ne peut jamais être inférieur au kilométrage actuel.',
  })
  create(
    @CurrentUser() user: AuthUser,
    @CompanyId() companyId: string,
    @Body() dto: CreateMileageDto,
  ) {
    return this.mileage.create(user, companyId, dto);
  }

  @Get('vehicles/:vehicleId/mileage')
  @Roles('GESTIONNAIRE')
  @ApiOperation({ summary: "Historique des relevés d'un véhicule" })
  findForVehicle(
    @CompanyId() companyId: string,
    @Param('vehicleId', UuidPipe) vehicleId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.mileage.findForVehicle(companyId, vehicleId, query);
  }

  @Get('drivers/me/mileage')
  @Roles('CHAUFFEUR')
  @ApiOperation({ summary: 'Historique des relevés saisis par le chauffeur connecté' })
  findMine(
    @CurrentUser() user: AuthUser,
    @CompanyId() companyId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.mileage.findForDriver(user, companyId, query);
  }
}
