import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '../config/env.validation';

/** Identifiant de requête accepté depuis un proxy (X-Request-Id), sinon généré. */
const REQUEST_ID = /^[\w-]{8,64}$/;

/**
 * Logs structurés (pino) : une ligne JSON par événement en production, prête à
 * être centralisée (Better Stack, Loki, Datadog...) ; format lisible en
 * développement. Chaque requête porte un identifiant renvoyé dans X-Request-Id,
 * pour retrouver les logs d'une erreur signalée par un utilisateur.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:HH:MM:ss',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const incoming = req.headers['x-request-id'];
            const id =
              typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
          },
          // Ni en-têtes (token, cookies), ni corps (mots de passe), ni adresse IP.
          serializers: {
            req: (req: { id: string; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          customLogLevel: (_req: IncomingMessage, res: ServerResponse, error?: Error) =>
            error || res.statusCode >= 500 ? 'error' : 'info',
          // La surveillance interroge /health en continu : inutile de le journaliser.
          autoLogging: { ignore: (req: IncomingMessage) => req.url === '/health' },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
