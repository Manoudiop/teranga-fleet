import { ApiPropertyOptional } from '@nestjs/swagger';
import { AlertSeverity, AlertType } from '@teranga-fleet/shared';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class AlertQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ enum: Object.values(AlertSeverity) })
  @IsOptional()
  @IsIn(Object.values(AlertSeverity))
  severity?: AlertSeverity;

  @ApiPropertyOptional({ enum: Object.values(AlertType) })
  @IsOptional()
  @IsIn(Object.values(AlertType))
  type?: AlertType;
}
