import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthUserResponse, LoginResponse } from '@teranga-fleet/shared';
import { AppException, badRequest, conflict } from '../common/errors/app.exception';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './auth-user';
import { accountBlock } from './account-status';
import type {
  ChangePasswordDto,
  LoginDto,
  PreferencesDto,
  RegisterCompanyDto,
} from './dto/auth.dto';
import { PasswordService } from './password.service';

const userResponseSelect = {
  id: true,
  nom: true,
  email: true,
  role: true,
  company: { select: { id: true, nom: true } },
  driver: { select: { id: true, nom: true, prenom: true } },
  alertDigest: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    // Seul endroit de l'API qui lit le hash du mot de passe (exclu par défaut).
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      omit: { password: false },
      include: { company: { select: { suspendedAt: true } } },
    });

    // Vérification systématique (hash factice si l'email est inconnu) et
    // message identique dans les deux cas : on ne révèle pas si le compte existe.
    const valid = await this.passwords.verify(user?.password, dto.password);
    if (!user || !valid) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Email ou mot de passe incorrect',
      );
    }
    // Après le mot de passe : un tiers ne peut pas savoir si un compte est désactivé.
    const block = accountBlock(user, user.company);
    if (block) throw new AppException(HttpStatus.FORBIDDEN, block.error, block.message);
    return this.issueToken(user.id);
  }

  /** Préférences de notification du compte connecté. */
  async updatePreferences(userId: string, dto: PreferencesDto): Promise<AuthUserResponse> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { alertDigest: dto.alertDigest },
      select: userResponseSelect,
    });
  }

  /** Changement de son propre mot de passe (le mot de passe actuel est exigé). */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { password: true },
    });
    if (!(await this.passwords.verify(user.password, dto.currentPassword))) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_CREDENTIALS',
        'Le mot de passe actuel est incorrect',
      );
    }
    if (dto.currentPassword === dto.newPassword) {
      throw badRequest("Le nouveau mot de passe doit être différent de l'actuel");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await this.passwords.hash(dto.newPassword) },
    });
  }

  /** Crée l'entreprise et son gestionnaire dans une seule transaction. */
  async registerCompany(dto: RegisterCompanyDto): Promise<LoginResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.gestionnaire.email },
      select: { id: true },
    });
    if (existing) throw conflict('Un compte existe déjà avec cet email');

    const passwordHash = await this.passwords.hash(dto.gestionnaire.password);
    const userId = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: dto.entreprise });
      const user = await tx.user.create({
        data: {
          nom: dto.gestionnaire.nom,
          email: dto.gestionnaire.email,
          password: passwordHash,
          role: 'GESTIONNAIRE',
          companyId: company.id,
        },
        select: { id: true },
      });
      return user.id;
    });
    return this.issueToken(userId);
  }

  async me(userId: string): Promise<AuthUserResponse> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: userResponseSelect,
    });
  }

  private async issueToken(userId: string): Promise<LoginResponse> {
    const payload: JwtPayload = { sub: userId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.get('JWT_EXPIRES_IN', { infer: true }),
      user: await this.me(userId),
    };
  }
}
