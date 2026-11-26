import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { readPositiveInt } from '../config/read-env.js';
import { THROTTLE_KEY } from './throttle.decorator.js';
import type { ThrottleOptions } from './throttle.decorator.js';

/** 429 — corps normalisé par le filtre global, message français. */
export class TooManyRequestsException extends HttpException {
  constructor() {
    super('Trop de tentatives. Réessayez dans un instant.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

const FENETRE_NETTOYAGE_MS = 60_000;

/**
 * Limitation de débit par IP et par route, en mémoire.
 *
 * POURQUOI pas @nestjs/throttler : la version publiée pour NestJS 12 est ESM
 * et casse la chaîne de test ; cette garde tient en quelques dizaines de lignes,
 * couvre exactement le besoin du sprint 1 (protéger le login d'une force brute,
 * répondre 429) et reste testable sans dépendance.
 *
 * LIMITE ASSUMÉE : le compteur est LOCAL au processus. En déploiement
 * mono-instance (la cible de ce sprint), c'est exact ; derrière plusieurs
 * instances il faudra un stockage partagé (Redis), comme noté dans
 * docs/decisions.md.
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly fenetres = new Map<string, number[]>();
  private readonly limiteParDefaut: number;
  private readonly ttlParDefaut: number;
  private dernierNettoyage = Date.now();

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    this.limiteParDefaut = readPositiveInt(config.get<string>('THROTTLE_LIMIT'), 120);
    this.ttlParDefaut = readPositiveInt(config.get<string>('THROTTLE_TTL_MS'), 60_000);
  }

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<ThrottleOptions>(THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? { limit: this.limiteParDefaut, ttlMs: this.ttlParDefaut };

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const maintenant = Date.now();

    const cle = `${context.getClass().name}.${context.getHandler().name}:${clientIp(request)}`;
    const recentes = (this.fenetres.get(cle) ?? []).filter(
      (horodatage) => maintenant - horodatage < options.ttlMs,
    );

    if (recentes.length >= options.limit) {
      this.fenetres.set(cle, recentes);
      const plusAncienne = recentes[0] ?? maintenant;
      const secondes = Math.ceil((options.ttlMs - (maintenant - plusAncienne)) / 1000);
      response.setHeader('Retry-After', String(Math.max(secondes, 1)));
      throw new TooManyRequestsException();
    }

    recentes.push(maintenant);
    this.fenetres.set(cle, recentes);
    this.nettoyer(maintenant);

    return true;
  }

  /** Purge périodique : sans elle, la Map conserverait une entrée par IP à vie. */
  private nettoyer(maintenant: number): void {
    if (maintenant - this.dernierNettoyage < FENETRE_NETTOYAGE_MS) {
      return;
    }

    this.dernierNettoyage = maintenant;

    for (const [cle, horodatages] of this.fenetres) {
      const restants = horodatages.filter(
        (horodatage) => maintenant - horodatage < this.ttlParDefaut,
      );
      if (restants.length === 0) {
        this.fenetres.delete(cle);
      } else {
        this.fenetres.set(cle, restants);
      }
    }
  }
}

function clientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? 'inconnue';
}
