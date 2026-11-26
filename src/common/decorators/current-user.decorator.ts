import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../types/auth.types.js';

/** Injecte l'utilisateur issu du JWT validé (voir JwtStrategy). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (request.user === undefined) {
      throw new Error('CurrentUser utilisé sans JwtAuthGuard : configuration de route invalide.');
    }
    return request.user;
  },
);
