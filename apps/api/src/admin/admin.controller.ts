import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountsService } from '../accounts/accounts.service';
import {
  CreateAccountDto,
  SetCompanyStatusDto,
  SetPasswordDto,
  UpdateAccountDto,
} from '../accounts/dto/account.dto';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser, Roles } from '../auth/decorators';
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

/** Périmètre de l'administrateur : tous les comptes de la plateforme. */
const ALL_ACCOUNTS = {};

@ApiTags('Admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly accounts: AccountsService,
  ) {}

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

  @Patch('companies/:id/status')
  @ApiOperation({ summary: 'Suspend ou réactive une entreprise (tous ses comptes)' })
  setCompanyStatus(@Param('id', UuidPipe) id: string, @Body() dto: SetCompanyStatusDto) {
    return this.admin.setCompanySuspended(id, dto.suspended);
  }

  @Post('companies/:id/managers')
  @ApiOperation({ summary: "Crée un compte gestionnaire pour l'entreprise" })
  async createManager(@Param('id', UuidPipe) id: string, @Body() dto: CreateAccountDto) {
    await this.admin.assertCompanyExists(id);
    return this.accounts.create(id, 'GESTIONNAIRE', dto);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Modifie, désactive ou réactive un compte' })
  updateUser(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accounts.update(ALL_ACCOUNTS, user.id, id, dto);
  }

  @Put('users/:id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Définit un nouveau mot de passe pour un compte' })
  async setPassword(@Param('id', UuidPipe) id: string, @Body() dto: SetPasswordDto) {
    await this.accounts.setPassword(ALL_ACCOUNTS, id, dto.password);
  }
}
