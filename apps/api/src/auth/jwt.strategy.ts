import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppException } from '../common/errors/app.exception';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { accountBlock, sessionRevoked } from './account-status';
import type { AuthUser, JwtPayload } from './auth-user';

/**
 * Valide le JWT puis relit l'utilisateur en base : un compte supprimé, dont le
 * rôle a changé, désactivé, ou dont l'entreprise est suspendue est pris en
 * compte immédiatement, sans attendre l'expiration du token. Le rôle et
 * l'entreprise ne sont donc jamais lus depuis le token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        disabledAt: true,
        passwordChangedAt: true,
        company: { select: { suspendedAt: true } },
        driver: { select: { id: true } },
      },
    });
    // Compte supprimé, ou mot de passe réinitialisé depuis l'émission du token.
    if (!user || sessionRevoked(payload.iat, user.passwordChangedAt)) {
      throw new UnauthorizedException();
    }
    // Compte désactivé ou entreprise suspendue pendant la session : 401, le
    // client se déconnecte et affiche la raison.
    const block = accountBlock(user, user.company);
    if (block) throw new AppException(HttpStatus.UNAUTHORIZED, block.error, block.message);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      driverId: user.driver?.id ?? null,
    };
  }
}
