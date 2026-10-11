import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ALL_ROLES, type AuthUser } from './auth-user';
import { AuthService } from './auth.service';
import { CurrentUser, Public, Roles } from './decorators';
import { LoginDto, RegisterCompanyDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register-company')
  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary: 'Crée une entreprise et son compte gestionnaire, puis connecte ce dernier',
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de tentatives depuis cette adresse IP' })
  registerCompany(@Body() dto: RegisterCompanyDto) {
    return this.auth.registerCompany(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Connexion par email et mot de passe' })
  @ApiTooManyRequestsResponse({ description: 'Trop de tentatives depuis cette adresse IP' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @Roles(...ALL_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
