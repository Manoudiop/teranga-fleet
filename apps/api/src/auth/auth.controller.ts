import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ALL_ROLES, type AuthUser } from './auth-user';
import { AuthService } from './auth.service';
import { CurrentUser, Public, Roles } from './decorators';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterCompanyDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { PasswordResetService } from './password-reset.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly resets: PasswordResetService,
  ) {}

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

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary: 'Envoie un lien de réinitialisation par email',
    description:
      "Répond toujours 204, que le compte existe ou non, et avant tout traitement : ni la réponse ni sa durée ne révèlent l'existence d'un compte.",
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de tentatives depuis cette adresse IP' })
  forgotPassword(@Body() dto: ForgotPasswordDto): void {
    this.resets.requestInBackground(dto.email);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary: 'Choisit un nouveau mot de passe avec le lien reçu par email',
    description: 'Le lien ne sert qu’une fois ; les sessions ouvertes avant sont fermées.',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.resets.reset(dto.token, dto.password);
  }

  @Get('me')
  @Roles(...ALL_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Put('password')
  @Roles(...ALL_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change son propre mot de passe (mot de passe actuel exigé)' })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.id, dto);
  }
}
