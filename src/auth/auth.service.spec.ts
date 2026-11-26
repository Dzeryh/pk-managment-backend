import { jest } from '@jest/globals';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import type { Repository, UpdateResult } from 'typeorm';
import { UserRole } from '../users/user-role.enum.js';
import type { User } from '../users/user.entity.js';
import type { UsersService } from '../users/users.service.js';
import type { PublicUser } from '../common/types/auth.types.js';
import type { AccessTokenService } from './access-token.service.js';
import type { AuthRefreshToken } from './auth-refresh-token.entity.js';
import type { AuthSession } from './auth-session.entity.js';
import { AuthService } from './auth.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

const UUID_APPAREIL = '3f1b8f0e-1c1d-4d0e-9a8b-2c3d4e5f6a7b';
const HASH_ACTUEL = bcrypt.hashSync('Ancien123', 4);
const DANS_UN_JOUR = new Date(Date.now() + 24 * 60 * 60 * 1000);

function configAvec(valeurs: Record<string, string>): ConfigService {
  return { get: (cle: string) => valeurs[cle] } as unknown as ConfigService;
}

function resultatMiseAJour(affected: number): UpdateResult {
  return { affected, raw: [], generatedMaps: [] };
}

function creerUtilisateur(surcharges: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'admin@pk.local',
    fullName: 'Administrateur P&K',
    role: UserRole.ADMIN,
    passwordHash: HASH_ACTUEL,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...surcharges,
  };
}

function creerService() {
  const users = {
    findByEmailWithPassword: jest.fn<(email: string) => Promise<User | null>>(),
    findByIdWithPassword: jest.fn<(id: string) => Promise<User | null>>(),
    findPublicById: jest.fn<(id: string) => Promise<PublicUser | null>>(),
    setPassword: jest.fn<(userId: string, passwordHash: string) => Promise<void>>(
      async () => undefined,
    ),
  };

  const sessions = {
    create: jest.fn<(valeurs: Partial<AuthSession>) => Partial<AuthSession>>((valeurs) => valeurs),
    save: jest.fn<(valeurs: Partial<AuthSession>) => Promise<AuthSession>>(
      async (valeurs) => ({ id: 'session-1', ...valeurs }) as AuthSession,
    ),
    findOne: jest.fn<() => Promise<AuthSession | null>>(),
    update: jest.fn<() => Promise<UpdateResult>>(async () => resultatMiseAJour(1)),
  };

  const refreshTokens = {
    create: jest.fn<(valeurs: Partial<AuthRefreshToken>) => Partial<AuthRefreshToken>>(
      (valeurs) => valeurs,
    ),
    save: jest.fn<(valeurs: Partial<AuthRefreshToken>) => Promise<Partial<AuthRefreshToken>>>(
      async (valeurs) => valeurs,
    ),
    findOne: jest.fn<() => Promise<Record<string, unknown> | null>>(),
    update: jest.fn<() => Promise<UpdateResult>>(async () => resultatMiseAJour(1)),
  };

  const accessTokens = {
    issue: jest.fn<() => Promise<{ accessToken: string; expiresIn: number }>>(async () => ({
      accessToken: 'access-token',
      expiresIn: 900,
    })),
  };

  const service = new AuthService(
    users as unknown as UsersService,
    sessions as unknown as Repository<AuthSession>,
    refreshTokens as unknown as Repository<AuthRefreshToken>,
    accessTokens as unknown as AccessTokenService,
    new RefreshTokenService(configAvec({ REFRESH_TOKEN_TTL_DAYS: '30' })),
  );

  return { users, sessions, refreshTokens, accessTokens, service };
}

describe('AuthService', () => {
  describe('login', () => {
    it('répond le même message pour un email inconnu et un mauvais mot de passe', async () => {
      const { users, service } = creerService();
      const dto = { identifier: 'inconnu@pk.local', password: 'Mauvais123', deviceId: UUID_APPAREIL };

      users.findByEmailWithPassword.mockResolvedValue(null);
      await expect(service.login(dto, 'web')).rejects.toThrow('Identifiants invalides.');

      users.findByEmailWithPassword.mockResolvedValue(creerUtilisateur());
      await expect(service.login(dto, 'web')).rejects.toThrow('Identifiants invalides.');
    });

    it('refuse un compte désactivé avec le même message', async () => {
      const { users, service } = creerService();
      users.findByEmailWithPassword.mockResolvedValue(creerUtilisateur({ isActive: false }));

      await expect(
        service.login(
          { identifier: 'admin@pk.local', password: 'Ancien123', deviceId: UUID_APPAREIL },
          'web',
        ),
      ).rejects.toThrow('Identifiants invalides.');
    });

    it('crée une session et renvoie un couple de jetons sans hash de mot de passe', async () => {
      const { users, sessions, refreshTokens, accessTokens, service } = creerService();
      users.findByEmailWithPassword.mockResolvedValue(creerUtilisateur());

      const resultat = await service.login(
        { identifier: 'Admin@PK.local', password: 'Ancien123', deviceId: UUID_APPAREIL, deviceName: 'Caisse' },
        'mobile',
      );

      expect(users.findByEmailWithPassword).toHaveBeenCalledWith('admin@pk.local');
      expect(sessions.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', clientType: 'mobile', deviceName: 'Caisse' }),
      );
      expect(accessTokens.issue).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), 'session-1');
      expect(refreshTokens.save).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-1', usedAt: null }),
      );

      const empreinteStockee = refreshTokens.save.mock.calls[0][0].tokenHash as string;
      expect(empreinteStockee).toMatch(/^[a-f0-9]{64}$/);
      expect(empreinteStockee).not.toBe(resultat.tokens.refreshToken);
      expect(resultat.tokens.accessToken).toBe('access-token');
      expect(resultat.user).toEqual({
        id: 'user-1',
        email: 'admin@pk.local',
        fullName: 'Administrateur P&K',
        role: UserRole.ADMIN,
      });
    });
  });

  describe('refresh', () => {
    function sessionValide(surcharges: Partial<AuthSession> = {}): AuthSession {
      return {
        id: 'session-1',
        userId: 'user-1',
        deviceId: UUID_APPAREIL,
        deviceName: null,
        clientType: 'web',
        expiresAt: DANS_UN_JOUR,
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...surcharges,
      } as AuthSession;
    }

    it('révoque toute la session quand un refresh token déjà consommé est rejoué', async () => {
      const { refreshTokens, sessions, service } = creerService();
      refreshTokens.findOne.mockResolvedValue({
        id: 'rt-1',
        sessionId: 'session-1',
        tokenHash: 'hash',
        expiresAt: DANS_UN_JOUR,
        usedAt: new Date(),
        session: sessionValide(),
      });

      await expect(service.refresh('jeton-rejoue', undefined, 'web')).rejects.toThrow(
        'Session expirée. Veuillez vous reconnecter.',
      );
      expect(sessions.update).toHaveBeenCalledWith(
        { id: 'session-1', revokedAt: expect.anything() },
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('refuse un refresh token inconnu', async () => {
      const { refreshTokens, service } = creerService();
      refreshTokens.findOne.mockResolvedValue(null);

      await expect(service.refresh('inconnu', undefined, 'web')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('révoque la session si le mobile présente un autre appareil', async () => {
      const { refreshTokens, sessions, service } = creerService();
      refreshTokens.findOne.mockResolvedValue({
        id: 'rt-1',
        sessionId: 'session-1',
        tokenHash: 'hash',
        expiresAt: DANS_UN_JOUR,
        usedAt: null,
        session: sessionValide({ clientType: 'mobile' }),
      });

      await expect(
        service.refresh('jeton', '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e', 'mobile'),
      ).rejects.toThrow('Session expirée. Veuillez vous reconnecter.');
      expect(sessions.update).toHaveBeenCalled();
    });

    it('consomme l’ancien jeton et en émet un nouveau (rotation)', async () => {
      const { refreshTokens, sessions, users, accessTokens, service } = creerService();
      const session = sessionValide();

      refreshTokens.findOne.mockResolvedValue({
        id: 'rt-1',
        sessionId: 'session-1',
        tokenHash: 'hash',
        expiresAt: DANS_UN_JOUR,
        usedAt: null,
        session,
      });
      users.findPublicById.mockResolvedValue({
        id: 'user-1',
        email: 'admin@pk.local',
        fullName: 'Administrateur P&K',
        role: UserRole.ADMIN,
      });

      const resultat = await service.refresh('ancien-jeton', undefined, 'web');

      expect(refreshTokens.update).toHaveBeenCalledWith(
        { id: 'rt-1', usedAt: expect.anything() },
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
      expect(refreshTokens.save).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-1', usedAt: null }),
      );
      expect(accessTokens.issue).toHaveBeenCalled();
      expect(resultat.tokens.refreshToken.length).toBeGreaterThan(40);
      expect(sessions.update).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('refuse un mot de passe actuel incorrect', async () => {
      const { users, service } = creerService();
      users.findByIdWithPassword.mockResolvedValue(creerUtilisateur());

      await expect(
        service.changePassword('user-1', 'session-1', {
          currentPassword: 'Faux1234',
          newPassword: 'Nouveau123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.setPassword).not.toHaveBeenCalled();
    });

    it('met à jour le hash et révoque les autres sessions', async () => {
      const { users, sessions, service } = creerService();
      users.findByIdWithPassword.mockResolvedValue(creerUtilisateur());

      await service.changePassword('user-1', 'session-1', {
        currentPassword: 'Ancien123',
        newPassword: 'Nouveau123',
      });

      expect(users.setPassword).toHaveBeenCalledWith('user-1', expect.any(String));
      const nouveauHash = users.setPassword.mock.calls[0][1] as string;
      expect(await bcrypt.compare('Nouveau123', nouveauHash)).toBe(true);
      expect(sessions.update).toHaveBeenCalledWith(
        { userId: 'user-1', id: expect.anything(), revokedAt: expect.anything() },
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });
  });
});
