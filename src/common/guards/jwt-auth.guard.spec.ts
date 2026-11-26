import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function creerGarde(isPublic: boolean): JwtAuthGuard {
  const reflector = {
    getAllAndOverride: () => isPublic,
  };

  return new JwtAuthGuard(reflector as unknown as Reflector);
}

function contexte(): ExecutionContext {
  return {
    getHandler: () => ({ name: 'me' }),
    getClass: () => ({ name: 'MeController' }),
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('laisse passer une route marquée @Public sans jeton', () => {
    expect(creerGarde(true).canActivate(contexte())).toBe(true);
  });

  it('répond 401 quand Passport renvoie `false` (aucun jeton)', () => {
    const garde = creerGarde(false);

    expect(() => garde.handleRequest(false, false, null)).toThrow(UnauthorizedException);
    expect(() => garde.handleRequest(null, null, null)).toThrow(UnauthorizedException);
    expect(() => garde.handleRequest(null, undefined, null)).toThrow(UnauthorizedException);
  });

  it('renvoie l’utilisateur validé par la stratégie', () => {
    const garde = creerGarde(false);
    const utilisateur = {
      id: 'user-1',
      email: 'admin@pk.local',
      role: 'ADMIN',
      sessionId: 'session-1',
    };

    expect(garde.handleRequest(null, utilisateur, null)).toEqual(utilisateur);
  });
});
