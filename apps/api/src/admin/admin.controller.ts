import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../auth/decorators';
import { PaginationQueryDto } from '../common/pagination';
import { UuidPipe } from '../common/uuid.pipe';
import { Trim } from '../common/validators';
import { AdminService } from './admin.service';

export class CompanyQueryDto extends PaginationQueryDto {
  /** Recherche sur le nom ou l'email de l'entreprise. */
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;
}

@ApiTags('Admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques globales de la plateforme' })
  stats() {
    return this.admin.stats();
  }

  @Get('companies')
  @ApiOperation({ summary: 'Entreprises clientes avec leurs volumes' })
  companies(@Query() query: CompanyQueryDto) {
    return this.admin.companies(query);
  }

  @Get('companies/:id')
  @ApiOperation({ summary: "Détail d'une entreprise et de ses comptes" })
  company(@Param('id', UuidPipe) id: string) {
    return this.admin.company(id);
  }
}
