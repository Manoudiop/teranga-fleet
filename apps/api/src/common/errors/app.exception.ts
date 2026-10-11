import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorCode } from '@teranga-fleet/shared';

/**
 * Exception métier : un statut HTTP, un code stable exploitable par les clients
 * et un message lisible, affichable tel quel à l'utilisateur.
 */
export class AppException extends HttpException {
  constructor(status: HttpStatus, error: ApiErrorCode, message: string) {
    super({ statusCode: status, error, message }, status);
  }
}

export const notFound = (message: string) =>
  new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', message);

export const conflict = (message: string, error: ApiErrorCode = 'CONFLICT') =>
  new AppException(HttpStatus.CONFLICT, error, message);

export const badRequest = (message: string, error: ApiErrorCode = 'BAD_REQUEST') =>
  new AppException(HttpStatus.BAD_REQUEST, error, message);

export const forbidden = (message: string) =>
  new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);
