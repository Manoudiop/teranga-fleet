import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Env } from '../config/env.validation';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './password.service';

/**
 * jsonwebtoken lit une durée textuelle sans unité ("3600") comme des millisecondes :
 * une valeur purement numérique est donc convertie en nombre de secondes.
 */
function toJwtExpiresIn(value: string): JwtSignOptions['expiresIn'] {
  return /^\d+$/.test(value) ? Number(value) : (value as JwtSignOptions['expiresIn']);
}

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: toJwtExpiresIn(config.get('JWT_EXPIRES_IN', { infer: true })),
        },
      }),
    }),
    // Limite appliquée uniquement aux routes qui utilisent ThrottlerGuard (login, inscription).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        { name: 'auth', ttl: 60_000, limit: config.get('AUTH_RATE_LIMIT', { infer: true }) },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    JwtStrategy,
    // Ordre important : authentification d'abord, contrôle des rôles ensuite.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [PasswordService],
})
export class AuthModule {}
