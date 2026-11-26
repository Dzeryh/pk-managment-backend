import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { IsNull, Not } from 'typeorm';
import type { Repository } from 'typeorm';
import type { ClientType, PublicUser } from '../common/types/auth.types.js';
import { toPublicUser } from '../users/user.mapper.js';
import type { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthRefreshToken } from './auth-refresh-token.entity.js';
import { AuthSession } from './auth-session.entity.js';
import {
  BCRYPT_ROUNDS,
  MESSAGE_IDENTIFIANTS_INVALIDES,
  MESSAGE_SESSION_INVALIDE,
} from './auth.constants.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import { RefreshTokenService } from './refresh-token.service.js';

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

export interface AuthResult {
  tokens: AuthTokens;
  user: PublicUser;
}

/**
 * Hash factice comparé quand l'email est inconnu : le coût bcrypt est payé dans
 * tous les cas, donc le temps de réponse ne révèle pas l'existence du compte.
 * Calculé une seule fois par processus, au même coût que les vrais hashes.
 */
let hashFactice: string | null = null;
function hashFacticePourTiming(): string {
  hashFactice ??= bcrypt.hashSync('pk-business-manager-timing-guard', BCRYPT_ROUNDS);
  return hashFactice;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    @InjectRepository(AuthSession) private readonly sessions: Repository<AuthSession>,
    @InjectRepository(AuthRefreshToken)
    private readonly refreshTokens: Repository<AuthRefreshToken>,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * Connexion. Le message d'erreur est identique pour un email inconnu, un
   * mauvais mot de passe et un compte désactivé (règle de sécurité du contrat).
   */
  async login(dto: LoginDto, clientType: ClientType): Promise<AuthResult> {
    const email = dto.identifier.trim().toLowerCase();
    const user = await this.users.findByEmailWithPassword(email);

    const hashAComparer = user?.passwordHash ?? hashFacticePourTiming();
    const motDePasseValide = await bcrypt.compare(dto.password, hashAComparer);

    if (user === null || !motDePasseValide || user.isActive === false) {
      throw new UnauthorizedException(MESSAGE_IDENTIFIANTS_INVALIDES);
    }

    const now = new Date();
    const deviceName = dto.deviceName?.trim();

    const session = await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        deviceId: dto.deviceId,
        deviceName: deviceName !== undefined && deviceName.length > 0 ? deviceName : null,
        clientType,
        expiresAt: this.refreshTokenService.expiresAtFrom(now),
        revokedAt: null,
      }),
    );

    const tokens = await this.issueTokens(user, session);
    return { tokens, user: toPublicUser(user) };
  }

  /**
   * Rotation du refresh token.
   *
   * Toute anomalie (jeton inconnu, expiré, rejoué, appareil différent, type de
   * client différent) répond le MÊME 401 et révoque la session quand un rejeu
   * ou un vol est plausible.
   */
  async refresh(rawToken: string, deviceId: string | undefined, clientType: ClientType): Promise<AuthResult> {
    const tokenHash = this.refreshTokenService.hash(rawToken);
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash },
      relations: { session: true },
    });

    if (stored === null) {
      throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
    }

    const session = stored.session;
    const now = new Date();

    if (session.revokedAt !== null) {
      throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
    }

    if (stored.usedAt !== null) {
      // Rejeu d'un jeton déjà consommé : on révoque toute la session.
      await this.revokeSession(session.id, now);
      this.logger.warn(`Rejeu de refresh token détecté (session ${session.id}) : session révoquée.`);
      throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
    }

    if (stored.expiresAt.getTime() <= now.getTime() || session.expiresAt.getTime() <= now.getTime()) {
      await this.revokeSession(session.id, now);
      throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
    }

    if (session.clientType !== clientType) {
      await this.revokeSession(session.id, now);
      this.logger.warn(`Refresh token présenté par un autre type de client (session ${session.id}).`);
      throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
    }

    if (clientType === 'mobile' && (deviceId === undefined || session.deviceId !== deviceId)) {
      await this.revokeSession(session.id, now);
      this.logger.warn(`Refresh token présenté par un autre appareil (session ${session.id}).`);
      throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
    }

    // Consommation atomique : deux requêtes concurrentes ne peuvent pas
    // rotationner le même jeton. La perdante est traitée comme un rejeu.
    const consommation = await this.refreshTokens.update(
      { id: stored.id, usedAt: IsNull() },
      { usedAt: now },
    );

    if (consommation.affected !== 1) {
      await this.revokeSession(session.id, now);
      this.logger.warn(`Course sur la rotation du refresh token (session ${session.id}) : session révoquée.`);
      throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
    }

    const user = await this.users.findPublicById(session.userId);
    if (user === null) {
      await this.revokeSession(session.id, now);
      throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
    }

    const tokens = await this.issueTokens(user, session);
    return { tokens, user };
  }

  /** Déconnexion idempotente : un jeton inconnu n'est pas une erreur. */
  async logout(refreshToken: string | null): Promise<void> {
    if (refreshToken === null || refreshToken.length === 0) {
      return;
    }

    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: this.refreshTokenService.hash(refreshToken) },
    });

    if (stored !== null) {
      await this.revokeSession(stored.sessionId);
    }
  }

  /**
   * Change le mot de passe et révoque toutes les AUTRES sessions : un appareil
   * perdu ou un jeton volé ne survit pas au changement de mot de passe.
   */
  async changePassword(userId: string, sessionId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findByIdWithPassword(userId);

    if (user === null || user.isActive === false) {
      throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
    }

    const actuelValide = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!actuelValide) {
      throw new BadRequestException('Le mot de passe actuel est incorrect.');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit être différent du mot de passe actuel.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.users.setPassword(user.id, passwordHash);

    await this.sessions.update(
      { userId, id: Not(sessionId), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Objet utilisateur courant (`GET /api/me`). */
  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findPublicById(userId);
    if (user === null) {
      throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
    }
    return user;
  }

  /** Émet le couple access token + refresh token et persiste le hash du refresh. */
  private async issueTokens(
    user: Pick<User, 'id' | 'email' | 'role'>,
    session: AuthSession,
  ): Promise<AuthTokens> {
    const access = await this.accessTokens.issue(user, session.id);
    const refreshToken = this.refreshTokenService.generate();

    await this.refreshTokens.save(
      this.refreshTokens.create({
        sessionId: session.id,
        tokenHash: this.refreshTokenService.hash(refreshToken),
        expiresAt: session.expiresAt,
        usedAt: null,
      }),
    );

    return {
      accessToken: access.accessToken,
      expiresIn: access.expiresIn,
      refreshToken,
    };
  }

  private async revokeSession(sessionId: string, when: Date = new Date()): Promise<void> {
    await this.sessions.update({ id: sessionId, revokedAt: IsNull() }, { revokedAt: when });
  }
}
