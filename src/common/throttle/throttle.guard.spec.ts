import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ThrottleGuard, TooManyRequestsException } from './throttle.guard.js';

const LIMITE = { limit: 2, ttlMs: 60_000 };

function configAvec(valeurs: Record<string, string>): ConfigService {
  return { get: (cle: string) => valeurs[cle] } as unknown as ConfigService;
}

function contexte(ip: string): ExecutionContext {
  const request = { ip, socket: { remoteAddress: ip } } as Request;
  const response = { setHeader: () => undefined } as unknown as Response;

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => ({ name: 'login' }),
    getClass: () => ({ name: 'AuthController' }),
  } as unknown as ExecutionContext;
}

function creerGarde(): ThrottleGuard {
  const reflector = {
    getAllAndOverride: () => LIMITE,
  };

  return new ThrottleGuard(
    reflector as unknown as ConstructorParameters<typeof ThrottleGuard>[0],
    configAvec({ THROTTLE_LIMIT: '120', THROTTLE_TTL_MS: '60000' }),
  );
}

describe('ThrottleGuard', () => {
  it('laisse passer les requêtes sous le quota', () => {
    const garde = creerGarde();

    expect(garde.canActivate(contexte('10.0.0.1'))).toBe(true);
    expect(garde.canActivate(contexte('10.0.0.1'))).toBe(true);
  });

  it('répond 429 au-delà du quota, avec Retry-After', () => {
    const garde = creerGarde();
    garde.canActivate(contexte('10.0.0.2'));
    garde.canActivate(contexte('10.0.0.2'));

    let erreur: unknown = null;
    try {
      garde.canActivate(contexte('10.0.0.2'));
    } catch (error) {
      erreur = error;
    }

    expect(erreur).toBeInstanceOf(TooManyRequestsException);
    expect((erreur as TooManyRequestsException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect((erreur as TooManyRequestsException).message).toBe(
      'Trop de tentatives. Réessayez dans un instant.',
    );
  });

  it('compte séparément chaque adresse IP', () => {
    const garde = creerGarde();
    garde.canActivate(contexte('10.0.0.3'));
    garde.canActivate(contexte('10.0.0.3'));

    expect(garde.canActivate(contexte('10.0.0.4'))).toBe(true);
  });
});
