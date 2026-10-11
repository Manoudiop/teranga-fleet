import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsCalendarDate } from '../../common/dates';
import { PaginationQueryDto } from '../../common/pagination';
import { Trim } from '../../common/validators';
import { VehicleStatus } from '../../generated/prisma/enums';

const MAX_YEAR = new Date().getUTCFullYear() + 1;

export class CreateVehicleDto {
  /** Immatriculation, normalisée en majuscules (ex. DK-4521-AB). */
  @ApiProperty({ example: 'DK-4521-AB' })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9 -]{1,18}[A-Z0-9]$/, {
    message: "L'immatriculation ne peut contenir que des lettres, chiffres, espaces et tirets",
  })
  immatriculation: string;

  @ApiProperty({ example: 'Toyota' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  marque: string;

  @ApiProperty({ example: 'Hilux' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  modele: string;

  @ApiPropertyOptional({ example: 2019 })
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(MAX_YEAR)
  annee?: number;

  /** Catégorie libre : pick-up, utilitaire, minibus, berline, camion... */
  @ApiPropertyOptional({ example: 'Pick-up' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  type?: string;

  @ApiPropertyOptional({ example: '2019-06-14' })
  @IsOptional()
  @IsCalendarDate()
  dateAcquisition?: string;

  @ApiPropertyOptional({ enum: VehicleStatus, default: VehicleStatus.ACTIVE })
  @IsOptional()
  @IsEnum(VehicleStatus)
  statut?: VehicleStatus;

  /** Kilométrage à la mise en service dans l'application. Ensuite, il évolue uniquement via les relevés. */
  @ApiPropertyOptional({ example: 128450, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5_000_000)
  kilometrageActuel?: number;
}

/** Le kilométrage ne se modifie pas ici : il passe par les relevés (jamais à la baisse). */
export class UpdateVehicleDto extends PartialType(
  OmitType(CreateVehicleDto, ['kilometrageActuel'] as const),
) {}

export class VehicleQueryDto extends PaginationQueryDto {
  /** Recherche sur l'immatriculation, la marque ou le modèle. */
  @ApiPropertyOptional({ example: 'DK' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  search?: string;

  @ApiPropertyOptional({ enum: VehicleStatus })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;
}
