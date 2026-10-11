import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsBoolean, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export class CreateAssignmentDto {
  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiProperty()
  @IsUUID()
  driverId: string;

  /** Début de l'affectation (par défaut : maintenant). Ne peut pas être dans le futur. */
  @ApiPropertyOptional({ example: '2026-10-11T08:00:00Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateDebut?: string;
}

export class UpdateAssignmentDto {
  @ApiPropertyOptional({ example: '2026-10-01T08:00:00Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateDebut?: string;

  /** Corrige la date de fin d'une affectation terminée, ou termine l'affectation en cours. */
  @ApiPropertyOptional({ example: '2026-10-11T18:00:00Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateFin?: string;
}

export class EndAssignmentDto {
  /** Fin de l'affectation (par défaut : maintenant). */
  @ApiPropertyOptional({ example: '2026-10-11T18:00:00Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateFin?: string;
}

export class AssignmentQueryDto extends PaginationQueryDto {
  /** true : affectations en cours uniquement ; false : terminées uniquement. */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  driverId?: string;
}
