import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsCalendarDate } from '../../common/dates';
import { PaginationQueryDto } from '../../common/pagination';
import { NormalizedEmail, StrongPassword, Trim } from '../../common/validators';
import { DriverStatus } from '../../generated/prisma/enums';

export class DriverAccountDto {
  /** Email de connexion à l'application mobile. */
  @ApiProperty({ example: 'moussa.diop@teranga-logistique.sn' })
  @NormalizedEmail()
  email: string;

  @ApiProperty({ description: '8 caractères minimum, avec au moins une lettre et un chiffre' })
  @StrongPassword()
  password: string;
}

export class CreateDriverDto {
  @ApiProperty({ example: 'Diop' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nom: string;

  @ApiProperty({ example: 'Moussa' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  prenom: string;

  /** Téléphone (ex. +221 77 412 58 63). */
  @ApiPropertyOptional({ example: '+221 77 412 58 63' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  contact?: string;

  @ApiProperty({ example: 'SN-DK-2014-118734' })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  numeroPermis: string;

  @ApiProperty({ example: '2028-05-31' })
  @IsCalendarDate()
  dateExpirationPermis: string;

  @ApiPropertyOptional({ enum: DriverStatus, default: DriverStatus.ACTIF })
  @IsOptional()
  @IsEnum(DriverStatus)
  statut?: DriverStatus;

  /** Crée en même temps le compte de connexion à l'application mobile. */
  @ApiPropertyOptional({ type: DriverAccountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DriverAccountDto)
  compte?: DriverAccountDto;
}

export class UpdateDriverDto extends PartialType(OmitType(CreateDriverDto, ['compte'] as const)) {}

export const PERMIS_FILTERS = ['VALIDE', 'EXPIRANT_BIENTOT', 'EXPIRE'] as const;

export class DriverQueryDto extends PaginationQueryDto {
  /** Recherche sur le nom, le prénom, le contact ou le numéro de permis. */
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ enum: DriverStatus })
  @IsOptional()
  @IsEnum(DriverStatus)
  statut?: DriverStatus;

  /** Filtre sur l'état du permis de conduire. */
  @ApiPropertyOptional({ enum: PERMIS_FILTERS })
  @IsOptional()
  @IsIn(PERMIS_FILTERS)
  permis?: (typeof PERMIS_FILTERS)[number];
}
