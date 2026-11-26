import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { readBoolean, readPositiveInt } from '../common/config/read-env.js';

const NOM_COOKIE = 'pk_refresh';
const CHEMIN_COOKIE = '/api/auth';
const JOURS_PAR_DEFAUT = 30;

/**
 * Cookie de refresh token des clients « web ».
 *
 * `httpOnly` : inaccessible au JavaScript, donc hors de portée d'une XSS.
 * `Secure` : imposé en production (surchargeable par COOKIE_SECURE pour un
 * poste de test en HTTP). `SameSite=Lax` : le cookie n'accompagne pas les
 * requêtes inter-sites, ce qui bloque les attaques CSRF sur le refresh.
 * `Path=/api/auth` : le cookie n'est envoyé qu'aux routes d'authentification.
 */
@Injectable()
export class RefreshCookieService {
  static readonly NAME = NOM_COOKIE;
  static readonly PATH = CHEMIN_COOKIE;

  constructor(private readonly config: ConfigService) {}

  get maxAgeMs(): number {
    return (
      readPositiveInt(this.config.get<string>('REFRESH_TOKEN_TTL_DAYS'), JOURS_PAR_DEFAUT) *
      24 *
      60 *
      60 *
      1000
    );
  }

  private options(): CookieOptions {
    const secureParDefaut = this.config.get<string>('NODE_ENV') === 'production';
    const secure = readBoolean(this.config.get<string>('COOKIE_SECURE'), secureParDefaut);

    return {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: CHEMIN_COOKIE,
      maxAge: this.maxAgeMs,
    };
  }

  set(response: Response, refreshToken: string): void {
    response.cookie(NOM_COOKIE, refreshToken, this.options());
  }

  clear(response: Response): void {
    const { maxAge: _maxAge, ...options } = this.options();
    response.clearCookie(NOM_COOKIE, options);
  }
}
