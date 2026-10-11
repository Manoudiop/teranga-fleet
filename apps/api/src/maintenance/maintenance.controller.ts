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
import { CompanyId, Roles } from '../auth/decorators';
import { UuidPipe } from '../common/uuid.pipe';
import {
  CreateMaintenanceDto,
  MaintenanceDueQueryDto,
  MaintenanceQueryDto,
  UpdateMaintenanceDto,
} from './dto/maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Maintenance')
@ApiBearerAuth()
@Roles('GESTIONNAIRE')
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistre un entretien (fait avancer le compteur si besoin)' })
  create(@CompanyId() companyId: string, @Body() dto: CreateMaintenanceDto) {
    return this.maintenance.create(companyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Historique des entretiens, avec le coût total de la sélection' })
  findAll(@CompanyId() companyId: string, @Query() query: MaintenanceQueryDto) {
    return this.maintenance.findAll(companyId, query);
  }

  // Déclarée avant ':id'.
  @Get('due')
  @ApiOperation({ summary: 'Entretiens dépassés ou à prévoir (kilométrage ou date)' })
  due(@CompanyId() companyId: string, @Query() query: MaintenanceDueQueryDto) {
    return this.maintenance.due(companyId, query.vehicleId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un entretien" })
  findOne(@CompanyId() companyId: string, @Param('id', UuidPipe) id: string) {
    return this.maintenance.findOne(companyId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifie un entretien' })
  update(
    @CompanyId() companyId: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateMaintenanceDto,
  ) {
    return this.maintenance.update(companyId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un entretien' })
  async remove(@CompanyId() companyId: string, @Param('id', UuidPipe) id: string) {
    await this.maintenance.remove(companyId, id);
  }
}
