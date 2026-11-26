import { jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { PublicUser } from '../common/types/auth.types.js';
import { UserRole } from '../users/user-role.enum.js';
import { AuthController } from './auth.controller.js';
import type { AuthResult, AuthService } from './auth.service.js';
import { RefreshCookieService } from './refresh-cookie.service.js';

const UUID_APPAREIL = '3f1b8f0e-1c1d-4d0e-9a8b-2c3d4e5f6a7b';

const UTILISATEUR: PublicUser = {
  id: 'user-1',
  email: 'admin@pk.local',
  fullName: 'Administrateur P&K',
  role: UserRole.ADMIN,
};

const RESULTAT: AuthResult = {
  tokens: { accessToken: 'access-token', expiresIn: 900, refreshToken: 'refresh-token-opaque' },
  user: UTILISATEUR,
};

function configAvec(valeurs: Record<string, string>): ConfigService {
  return { get: (cle: string) => valeurs[cle] } as unknown as ConfigService;
}

function creerContexte(): {
  controller: AuthController;
  auth: Record<'login' | 'refresh' | 'logout' | 'changePassword' | 'me', Mock>;
  response: { cookie: Mock; clearCookie: Mock };
} {
  const auth = {
    login: jest.fn(async () => RESULTAT),
    refresh: jest.fn(async () => RESULTAT),
    logout: jest.fn(async () => undefined),
    changePassword: jest.fn(async () => undefined),
    me: jest.fn(async () => UTILISATEUR),
  };

  const response = { cookie: jest.fn(), clearCookie: jest.fn() };
  const controller = new AuthController(
    auth as unknown as AuthService,
    new RefreshCookieService(configAvec({ NODE_ENV: 'test', REFRESH_TOKEN_TTL_DAYS: '30' })),
  );

  return { controller, auth, response };
}

describe('AuthController', () => {
  const dtoLogin = {
    identifier: 'admin@pk.local',
    password: 'Ancien123',
    deviceId: UUID_APPAREIL,
  };

  it('pose un cookie httpOnly et ne renvoie pas le refresh token pour un client web', async () => {
    const { controller, response } = creerContexte();

    const corps = await controller.login(
      dtoLogin,
      'web',
      response as unknown as Response,
    );

    expect(corps.refreshToken).toBeUndefined();
    expect(corps.accessToken).toBe('access-token');
    expect(response.cookie).toHaveBeenCalledWith(
      RefreshCookieService.NAME,
      'refresh-token-opaque',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/auth',
        secure: false,
      }),
    );
  });

  it('renvoie le refresh token dans le corps pour un client mobile', async () => {
    const { controller, response } = creerContexte();

    const corps = await controller.login(
      dtoLogin,
      'mobile',
      response as unknown as Response,
    );

    expect(corps.refreshToken).toBe('refresh-token-opaque');
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('refuse un refresh web sans cookie de session', async () => {
    const { controller, response } = creerContexte();

    await expect(
      controller.refresh({}, 'web', { cookies: {} } as Request, response as unknown as Response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('exige refreshToken et deviceId pour un refresh mobile', async () => {
    const { controller, response } = creerContexte();

    await expect(
      controller.refresh({}, 'mobile', { cookies: {} } as Request, response as unknown as Response),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('utilise le cookie pour révoquer la session web au logout', async () => {
    const { controller, auth, response } = creerContexte();

    await controller.logout(
      {},
      'web',
      { cookies: { [RefreshCookieService.NAME]: 'jeton-cookie' } } as unknown as Request,
      response as unknown as Response,
    );

    expect(auth.logout).toHaveBeenCalledWith('jeton-cookie');
    expect(response.clearCookie).toHaveBeenCalledWith(
      RefreshCookieService.NAME,
      expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
    );
  });
});
