import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CompanyId, Roles } from '../auth/decorators';
import { DashboardService } from './dashboard.service';

export class MaintenanceCostsQueryDto {
  @ApiPropertyOptional({ default: 6, minimum: 1, maximum: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months: number = 6;
}

@ApiTags('Dashboard')
@ApiBearerAuth()
@Roles('GESTIONNAIRE')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Indicateurs clés de la flotte' })
  summary(@CompanyId() companyId: string) {
    return this.dashboard.summary(companyId);
  }

  @Get('maintenance-costs')
  @ApiOperation({ summary: "Coûts d'entretien mensuels (francs CFA) sur les derniers mois" })
  maintenanceCosts(@CompanyId() companyId: string, @Query() query: MaintenanceCostsQueryDto) {
    return this.dashboard.maintenanceCosts(companyId, query.months);
  }
}
