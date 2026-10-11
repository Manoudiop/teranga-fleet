import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsCalendarDate } from '../../common/dates';
import { PaginationQueryDto } from '../../common/pagination';
import { Trim } from '../../common/validators';

export class CreateMaintenanceDto {
  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  /** Nature de l'intervention (texte libre : vidange, révision, freins, pneus...). */
  @ApiProperty({ example: 'Vidange moteur + filtres' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  type: string;

  @ApiProperty({ example: '2026-10-01' })
  @IsCalendarDate()
  date: string;

  @ApiProperty({ example: 120150 })
  @IsInt()
  @Min(0)
  @Max(5_000_000)
  kilometrageAuMoment: number;

  /** Montant en francs CFA (XOF), sans décimales. */
  @ApiProperty({ example: 52000 })
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  cout: number;

  @ApiPropertyOptional({ example: 'Garage Touba Motors, Colobane' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(150)
  garage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ example: 130000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5_000_000)
  prochainEntretienKm?: number;

  @ApiPropertyOptional({ example: '2027-04-01' })
  @IsOptional()
  @IsCalendarDate()
  prochainEntretienDate?: string;
}

/** Le véhicule d'un entretien ne change pas : il faut supprimer et recréer. */
export class UpdateMaintenanceDto extends PartialType(
  OmitType(CreateMaintenanceDto, ['vehicleId'] as const),
) {}

export class MaintenanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  /** Recherche sur le type, le garage ou l'immatriculation. */
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsCalendarDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsCalendarDate()
  to?: string;
}

export class MaintenanceDueQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
