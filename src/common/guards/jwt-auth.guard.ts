import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Garde JWT globale. Les routes marquées @Public() passent sans jeton.
 * Toute absence de jeton ou jeton invalide renvoie 401 avec un message français.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    return super.canActivate(context);
  }

  override handleRequest<TUser = unknown>(err: unknown, user: unknown, _info: unknown): TUser {
    if (err !== null && err !== undefined) {
      throw err instanceof HttpException ? err : new UnauthorizedException('Authentification requise.');
    }

    // Passport renvoie `false` (et non `null`/`undefined`) quand aucun jeton
    // n'est présenté : sans ce test, la requête continuerait avec un
    // `request.user === false` et une erreur 500 au lieu d'un 401.
    if (typeof user !== 'object' || user === null) {
      throw new UnauthorizedException('Authentification requise.');
    }

    return user as TUser;
  }
}
