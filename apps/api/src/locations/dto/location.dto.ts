import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class LocationPointDto {
  @ApiProperty({ example: 14.6928 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: -17.4467 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  /** Précision horizontale en mètres. */
  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  /** Vitesse en m/s. */
  @ApiPropertyOptional({ example: 13.4 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(150)
  speed?: number;

  /** Cap en degrés (0 = nord). */
  @ApiPropertyOptional({ example: 270 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  /** Moment de la mesure sur le téléphone. */
  @ApiProperty({ example: '2026-10-11T08:15:00Z' })
  @IsISO8601({ strict: true })
  recordedAt: string;
}

export class CreateLocationsDto {
  /** Lot de positions (la file hors ligne du téléphone est envoyée en une fois). */
  @ApiProperty({ type: [LocationPointDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => LocationPointDto)
  points: LocationPointDto[];
}

export class LatestLocationsQueryDto {
  /** Ignore les positions plus anciennes (par défaut 7 jours). */
  @ApiPropertyOptional({ default: 168, minimum: 1, maximum: 720 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  maxAgeHours: number = 168;
}

export class TrackQueryDto {
  /** Début de la période (par défaut : 24 h avant `to`). */
  @ApiPropertyOptional({ example: '2026-10-11T00:00:00Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  /** Fin de la période (par défaut : maintenant). */
  @ApiPropertyOptional({ example: '2026-10-11T23:59:59Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
