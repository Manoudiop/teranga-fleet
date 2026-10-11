import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsCalendarDate } from '../../common/dates';
import { PaginationQueryDto } from '../../common/pagination';
import { Trim } from '../../common/validators';
import { DocumentType } from '../../generated/prisma/enums';

export class CreateDocumentDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  type: DocumentType;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsCalendarDate()
  dateEmission?: string;

  @ApiProperty({ example: '2027-01-14' })
  @IsCalendarDate()
  dateExpiration: string;
}

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}

export const DOCUMENT_STATUSES = ['VALIDE', 'EXPIRANT_BIENTOT', 'EXPIRE'] as const;

export class DocumentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  /** Statut calculé à partir de la date d'expiration. */
  @ApiPropertyOptional({ enum: DOCUMENT_STATUSES })
  @IsOptional()
  @IsIn(DOCUMENT_STATUSES)
  status?: (typeof DOCUMENT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  /** Recherche sur l'immatriculation du véhicule. */
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  search?: string;
}
