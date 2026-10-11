/** Format unique des erreurs renvoyées par l'API. */
export interface ApiErrorResponse {
  statusCode: number;
  /** Message lisible, affichable tel quel à l'utilisateur. */
  message: string;
  /** Code d'erreur stable, exploitable par les clients (ex. VALIDATION_ERROR). */
  error: string;
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
