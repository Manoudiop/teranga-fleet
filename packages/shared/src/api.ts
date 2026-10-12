/** Codes d'erreur stables renvoyés par l'API dans le champ `error`. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'COMPANY_SUSPENDED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'MILEAGE_TOO_LOW'
  | 'VEHICLE_UNAVAILABLE'
  | 'DRIVER_UNAVAILABLE'
  | 'NO_ACTIVE_ASSIGNMENT'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'TOO_MANY_REQUESTS'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

/** Format unique des erreurs renvoyées par l'API. */
export interface ApiErrorResponse {
  statusCode: number;
  /** Message lisible, affichable tel quel à l'utilisateur. */
  message: string;
  /** Code d'erreur stable, exploitable par les clients. */
  error: ApiErrorCode;
  /** Détail champ par champ pour les erreurs de validation. */
  details?: Record<string, string[]>;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
