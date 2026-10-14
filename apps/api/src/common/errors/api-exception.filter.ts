import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorCode, ApiErrorResponse } from '@teranga-fleet/shared';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { reportError } from '../report-error';

const DEFAULT_CODES: Partial<Record<number, ApiErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'FILE_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_FILE_TYPE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

const DEFAULT_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Requête invalide',
  [HttpStatus.UNAUTHORIZED]: 'Authentification requise',
  [HttpStatus.FORBIDDEN]: "Vous n'avez pas accès à cette ressource",
  [HttpStatus.NOT_FOUND]: 'Ressource introuvable',
  [HttpStatus.CONFLICT]: 'Conflit avec les données existantes',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Fichier trop volumineux',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Trop de tentatives, réessayez dans une minute',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service momentanément indisponible, réessayez plus tard',
};

/**
 * Convertit toute erreur en réponse au format ApiErrorResponse. Les erreurs
 * inattendues sont journalisées et renvoyées sans détail technique.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) reportError(this.logger, 'Requête en erreur', exception);
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorResponse {
    if (exception instanceof HttpException) return this.fromHttp(exception);
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.fromPrisma(exception);
      if (mapped) return mapped;
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_ERROR',
      message: 'Une erreur inattendue est survenue. Réessayez plus tard.',
    };
  }

  private fromHttp(exception: HttpException): ApiErrorResponse {
    const statusCode = exception.getStatus();
    const response = exception.getResponse() as Record<string, unknown> | string;

    // Erreur produite par l'API (AppException) : code et message conservés.
    if (
      typeof response === 'object' &&
      typeof response.error === 'string' &&
      /^[A-Z_]+$/.test(response.error) &&
      typeof response.message === 'string'
    ) {
      return {
        statusCode,
        error: response.error as ApiErrorCode,
        message: response.message,
        ...(response.details ? { details: response.details as Record<string, string[]> } : {}),
      };
    }

    // Exception standard (Nest, Passport, Multer, Throttler) : ses messages sont
    // en anglais et parfois techniques, on renvoie le message français par défaut.
    return {
      statusCode,
      error: DEFAULT_CODES[statusCode] ?? (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
      message: DEFAULT_MESSAGES[statusCode] ?? 'Une erreur est survenue',
    };
  }

  private fromPrisma(e: Prisma.PrismaClientKnownRequestError): ApiErrorResponse | null {
    switch (e.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          error: 'CONFLICT',
          message: 'Cette valeur est déjà utilisée',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.CONFLICT,
          error: 'CONFLICT',
          message: 'Opération impossible : des données liées existent',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'NOT_FOUND',
          message: 'Ressource introuvable',
        };
      default:
        return null;
    }
  }
}
