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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CompanyId, CurrentUser, Roles } from '../auth/decorators';
import { UuidPipe } from '../common/uuid.pipe';
import { DriversService } from './drivers.service';
import {
  CreateDriverDto,
  DriverAccountDto,
  DriverQueryDto,
  UpdateDriverDto,
} from './dto/driver.dto';

@ApiTags('Drivers')
@ApiBearerAuth()
@Controller('drivers')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  // Déclarée avant ':id' : routes du chauffeur connecté (application mobile).
  @Get('me')
  @Roles('CHAUFFEUR')
  @ApiOperation({ summary: 'Profil du chauffeur connecté et son véhicule affecté' })
  me(@CurrentUser() user: AuthUser, @CompanyId() companyId: string) {
    return this.drivers.me(user.driverId, companyId);
  }

  @Post()
  @Roles('GESTIONNAIRE')
  @ApiOperation({ summary: 'Ajoute un chauffeur, avec éventuellement son compte mobile' })
  create(@CompanyId() companyId: string, @Body() dto: CreateDriverDto) {
    return this.drivers.create(companyId, dto);
  }

  @Get()
  @Roles('GESTIONNAIRE')
  @ApiOperation({ summary: 'Liste paginée des chauffeurs avec leur véhicule actuel' })
  findAll(@CompanyId() companyId: string, @Query() query: DriverQueryDto) {
    return this.drivers.findAll(companyId, query);
  }

  @Get(':id')
  @Roles('GESTIONNAIRE')
  @ApiOperation({ summary: "Fiche d'un chauffeur et historique de ses affectations" })
  findOne(@CompanyId() companyId: string, @Param('id', UuidPipe) id: string) {
    return this.drivers.findOne(companyId, id);
  }

  @Patch(':id')
  @Roles('GESTIONNAIRE')
  @ApiOperation({ summary: 'Modifie un chauffeur' })
  update(
    @CompanyId() companyId: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateDriverDto,
  ) {
    return this.drivers.update(companyId, id, dto);
  }

  @Delete(':id')
  @Roles('GESTIONNAIRE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un chauffeur sans historique (sinon, le passer en INACTIF)' })
  async remove(@CompanyId() companyId: string, @Param('id', UuidPipe) id: string) {
    await this.drivers.remove(companyId, id);
  }

  @Put(':id/account')
  @Roles('GESTIONNAIRE')
  @ApiOperation({ summary: 'Crée le compte mobile du chauffeur ou réinitialise ses identifiants' })
  setAccount(
    @CompanyId() companyId: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: DriverAccountDto,
  ) {
    return this.drivers.setAccount(companyId, id, dto);
  }
}
