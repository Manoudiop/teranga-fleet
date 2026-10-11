import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AlertsService } from '../alerts/alerts.service';
import { CompanyId, Roles } from '../auth/decorators';
import { UuidPipe } from '../common/uuid.pipe';
import { CreateVehicleDto, UpdateVehicleDto, VehicleQueryDto } from './dto/vehicle.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('Vehicles')
@ApiBearerAuth()
@Roles('GESTIONNAIRE')
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly alerts: AlertsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Ajoute un véhicule à la flotte' })
  create(@CompanyId() companyId: string, @Body() dto: CreateVehicleDto) {
    return this.vehicles.create(companyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste paginée des véhicules, avec recherche et filtres' })
  async findAll(@CompanyId() companyId: string, @Query() query: VehicleQueryDto) {
    if (query.alerts === undefined) return this.vehicles.findAll(companyId, query);
    const withAlerts = await this.alerts.vehicleIdsWithAlerts(companyId);
    return this.vehicles.findAll(
      companyId,
      query,
      query.alerts ? { in: withAlerts } : { notIn: withAlerts },
    );
  }

  @Get(':id')
  @ApiOperation({ summary: "Fiche d'un véhicule avec son chauffeur actuel" })
  findOne(@CompanyId() companyId: string, @Param('id', UuidPipe) id: string) {
    return this.vehicles.findOne(companyId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifie un véhicule (le kilométrage passe par les relevés)' })
  update(
    @CompanyId() companyId: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehicles.update(companyId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un véhicule et tout son historique' })
  async remove(@CompanyId() companyId: string, @Param('id', UuidPipe) id: string) {
    await this.vehicles.remove(companyId, id);
  }
}
