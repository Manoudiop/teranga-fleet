import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser, JwtPayload } from './auth-user';

/**
 * Valide le JWT puis relit l'utilisateur en base : un compte supprimé ou dont
 * le rôle a changé est pris en compte immédiatement, sans attendre l'expiration
 * du token. Le rôle et l'entreprise ne sont donc jamais lus depuis le token.
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
        driver: { select: { id: true } },
      },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      driverId: user.driver?.id ?? null,
    };
  }
}
