import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import type { UserRole } from '../../users/user-role.enum.js';

/** RBAC : refuse (403) un utilisateur authentifié dont le rôle n'est pas autorisé. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequis = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (rolesRequis === undefined || rolesRequis.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (user === undefined) {
      throw new UnauthorizedException('Authentification requise.');
    }

    if (!rolesRequis.includes(user.role)) {
      throw new ForbiddenException('Accès refusé : rôle insuffisant.');
    }

    return true;
  }
}
