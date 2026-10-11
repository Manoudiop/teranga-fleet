import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateMileageDto {
  /** Obligatoire pour un gestionnaire. Pour un chauffeur : son véhicule affecté (déduit si absent). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiProperty({ example: 128600 })
  @IsInt()
  @Min(0)
  @Max(5_000_000)
  kilometrage: number;

  /** Date et heure du relevé (par défaut : maintenant). */
  @ApiPropertyOptional({ example: '2026-10-11T18:00:00Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  date?: string;
}
