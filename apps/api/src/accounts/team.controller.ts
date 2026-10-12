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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CompanyId, CurrentUser, Roles } from '../auth/decorators';
import { UuidPipe } from '../common/uuid.pipe';
import { AccountsService, type AccountScope } from './accounts.service';
import { CreateAccountDto, SetPasswordDto, UpdateAccountDto } from './dto/account.dto';

/**
 * Équipe de l'entreprise : le gestionnaire gère les comptes des autres
 * gestionnaires. Les comptes chauffeurs se gèrent depuis la fiche chauffeur.
 */
@ApiTags('Team')
@ApiBearerAuth()
@Roles('GESTIONNAIRE')
@Controller('users')
export class TeamController {
  constructor(private readonly accounts: AccountsService) {}

  private scope(companyId: string): AccountScope {
    return { companyId, roles: ['GESTIONNAIRE'] };
  }

  @Get()
  @ApiOperation({ summary: "Gestionnaires de l'entreprise" })
  list(@CompanyId() companyId: string) {
    return this.accounts.list(this.scope(companyId));
  }

  @Post()
  @ApiOperation({ summary: 'Ajoute un gestionnaire à l’entreprise' })
  create(@CompanyId() companyId: string, @Body() dto: CreateAccountDto) {
    return this.accounts.create(companyId, 'GESTIONNAIRE', dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifie, désactive ou réactive un gestionnaire' })
  update(
    @CompanyId() companyId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accounts.update(this.scope(companyId), user.id, id, dto);
  }

  @Put(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Définit un nouveau mot de passe pour un gestionnaire' })
  async setPassword(
    @CompanyId() companyId: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: SetPasswordDto,
  ) {
    await this.accounts.setPassword(this.scope(companyId), id, dto.password);
  }
}
