import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { readPositiveInt } from '../common/config/read-env.js';

const JOURS_PAR_DEFAUT = 30;
const MILLISECONDES_PAR_JOUR = 24 * 60 * 60 * 1000;

/**
 * Jetons de rafraîchissement OPQUES (pas des JWT) :
 * - 48 octets aléatoires cryptographiques, encodés en base64url ;
 * - stockés uniquement sous forme de SHA-256 (rapide : le jeton a déjà une
 *   entropie de 384 bits, un hachage lent n'apporterait rien) ;
 * - à usage unique, avec détection de rejeu côté AuthService.
 */
@Injectable()
export class RefreshTokenService {
  private readonly ttlDays: number;

  constructor(config: ConfigService) {
    this.ttlDays = readPositiveInt(config.get<string>('REFRESH_TOKEN_TTL_DAYS'), JOURS_PAR_DEFAUT);
  }

  /** Nouveau jeton opaque, jamais journalisé. */
  generate(): string {
    return randomBytes(48).toString('base64url');
  }

  /** Empreinte stockée en base. */
  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  /** Échéance absolue d'une nouvelle session. */
  expiresAtFrom(now: Date = new Date()): Date {
    return new Date(now.getTime() + this.ttlDays * MILLISECONDES_PAR_JOUR);
  }

  get ttlMs(): number {
    return this.ttlDays * MILLISECONDES_PAR_JOUR;
  }
}
