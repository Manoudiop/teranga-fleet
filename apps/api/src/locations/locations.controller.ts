import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CompanyId, CurrentUser, Roles } from '../auth/decorators';
import { UuidPipe } from '../common/uuid.pipe';
import { CreateLocationsDto, LatestLocationsQueryDto, TrackQueryDto } from './dto/location.dto';
import { LocationsService } from './locations.service';

@ApiTags('Locations')
@ApiBearerAuth()
@Controller()
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post('locations')
  @Roles('CHAUFFEUR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envoie un lot de positions GPS du véhicule affecté',
    description:
      'Appelé par l’application mobile pendant le service du chauffeur. Les points dans le futur, ' +
      'de plus de 7 jours, antérieurs à l’affectation ou trop imprécis sont écartés ; les doublons ignorés.',
  })
  record(
    @CurrentUser() user: AuthUser,
    @CompanyId() companyId: string,
    @Body() dto: CreateLocationsDto,
  ) {
    return this.locations.record(user, companyId, dto);
  }

  @Get('locations/latest')
  @Roles('GESTIONNAIRE')
  @ApiOperation({ summary: 'Dernière position connue de chaque véhicule' })
  latest(@CompanyId() companyId: string, @Query() query: LatestLocationsQueryDto) {
    return this.locations.latest(companyId, query.maxAgeHours);
  }

  @Get('vehicles/:vehicleId/locations')
  @Roles('GESTIONNAIRE')
  @ApiOperation({ summary: "Tracé d'un véhicule sur une période (7 jours maximum)" })
  track(
    @CompanyId() companyId: string,
    @Param('vehicleId', UuidPipe) vehicleId: string,
    @Query() query: TrackQueryDto,
  ) {
    return this.locations.track(companyId, vehicleId, query);
  }
}
