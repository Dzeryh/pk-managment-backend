import { BadRequestException, createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ClientType as TypeClient } from '../types/auth.types.js';

export const CLIENT_TYPE_HEADER = 'x-client-type';

/**
 * Lit et valide l'en-tête `X-Client-Type`, qui décide du transport du refresh
 * token (cookie pour `web`, corps de réponse pour `mobile`).
 *
 * Décision : l'en-tête est OBLIGATOIRE sur les routes d'authentification.
 * Deviner la valeur par défaut reviendrait, pour un client mobile qui l'omet,
 * à lui poser un cookie qu'il ne peut pas lire — une panne silencieuse.
 */
export const ClientType = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TypeClient => {
    const request = context.switchToHttp().getRequest<Request>();
    const raw = request.header(CLIENT_TYPE_HEADER);

    if (raw !== 'web' && raw !== 'mobile') {
      throw new BadRequestException(
        "L'en-tête X-Client-Type est requis et doit valoir « web » ou « mobile ».",
      );
    }

    return raw;
  },
);
