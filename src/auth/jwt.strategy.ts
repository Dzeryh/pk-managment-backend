import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import type { AccessTokenPayload, AuthenticatedUser } from '../common/types/auth.types.js';
import { AuthSession } from './auth-session.entity.js';
import { MESSAGE_SESSION_INVALIDE } from './auth.constants.js';

/**
 * Validation de l'access token.
 *
 * Au-delà de la signature et de l'expiration (15 min), on vérifie que la
 * session référencée n'a pas été révoquée : un logout ou un changement de mot
 * de passe coupe donc l'accès IMMÉDIATEMENT, sans attendre l'expiration du JWT.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(AuthSession) private readonly sessions: Repository<AuthSession>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? '',
      algorithms: ['HS256'],
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (
      payload === null ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
    }

    const session = await this.sessions.findOne({ where: { id: payload.sid } });

    if (
      session === null ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sid,
    };
  }
}
