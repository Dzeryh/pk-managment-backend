import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

/** Corps d'erreur uniforme du contrat d'API. */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

const NOM_ERREUR: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'Method Not Allowed',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Payload Too Large',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

const MESSAGE_DEFAUT: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Requête invalide.',
  [HttpStatus.UNAUTHORIZED]: 'Authentification requise.',
  [HttpStatus.FORBIDDEN]: 'Accès refusé.',
  [HttpStatus.NOT_FOUND]: 'Ressource introuvable.',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'Méthode non autorisée.',
  [HttpStatus.CONFLICT]: 'Conflit de données.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Requête trop volumineuse.',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Données non exploitables.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Trop de tentatives. Réessayez dans un instant.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Une erreur interne est survenue. Réessayez plus tard.',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service temporairement indisponible.',
};

/** Messages techniques anglais produits par Nest/Passport/Throttler à ne jamais exposer. */
const MESSAGES_TECHNIQUES = new Set(
  [
    'Bad Request',
    'Unauthorized',
    'Forbidden',
    'Not Found',
    'Method Not Allowed',
    'Conflict',
    'Payload Too Large',
    'Internal server error',
    'Internal Server Error',
    'Service Unavailable',
    'Too Many Requests',
    'ThrottlerException: Too Many Requests',
    'ThrottlerException',
    'Request Entity Too Large',
  ].map((message) => message.toLowerCase()),
);

function messageParDefaut(status: number): string {
  return MESSAGE_DEFAUT[status] ?? MESSAGE_DEFAUT[HttpStatus.INTERNAL_SERVER_ERROR];
}

function estTechnique(message: string): boolean {
  return MESSAGES_TECHNIQUES.has(message.trim().toLowerCase());
}

function extraireMessage(corps: string | object, status: number): string | string[] {
  if (typeof corps === 'string') {
    return corps.trim().length > 0 && !estTechnique(corps) ? corps : messageParDefaut(status);
  }

  if (corps !== null && typeof corps === 'object' && 'message' in corps) {
    const message = (corps as { message?: unknown }).message;
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message as string[];
    }
    if (typeof message === 'string' && message.trim().length > 0 && !estTechnique(message)) {
      return message;
    }
  }

  return messageParDefaut(status);
}

/**
 * Filtre global : toute réponse d'erreur respecte
 * `{ statusCode, error, message, timestamp, path }`.
 *
 * Règle : aucun message technique brut ne sort. Les 5xx sont journalisés côté
 * serveur avec la pile, et le client ne reçoit qu'un message générique français.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const contexte = host.switchToHttp();
    const response = contexte.getResponse<Response>();
    const request = contexte.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = messageParDefaut(statusCode);

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      message = extraireMessage(exception.getResponse(), statusCode);

      if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
        message = messageParDefaut(statusCode);
        this.logger.error(
          `${request.method} ${request.originalUrl} -> ${statusCode}`,
          exception instanceof Error ? exception.stack : String(exception),
        );
      }
    } else {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> exception non gérée`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      message = messageParDefaut(statusCode);
    }

    const body: ApiErrorBody = {
      statusCode,
      error: NOM_ERREUR[statusCode] ?? 'Error',
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    response.status(statusCode).json(body);
  }
}
