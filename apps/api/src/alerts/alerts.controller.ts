import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CompanyId, CurrentUser, Roles } from '../auth/decorators';
import { AlertsService } from './alerts.service';
import { AlertQueryDto } from './dto/alert.dto';

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @Roles('GESTIONNAIRE', 'CHAUFFEUR')
  @ApiOperation({
    summary: 'Alertes triées par priorité',
    description:
      'Documents et permis expirés ou expirant sous le seuil, entretiens dépassés ou à prévoir, ' +
      'véhicules hors service ou en maintenance, incidents graves en cours. ' +
      'Un chauffeur ne reçoit que les alertes de son véhicule affecté et de son permis.',
  })
  list(
    @CurrentUser() user: AuthUser,
    @CompanyId() companyId: string,
    @Query() query: AlertQueryDto,
  ) {
    return this.alerts.list(user, companyId, query);
  }
}
