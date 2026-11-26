import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { readPositiveInt } from '../common/config/read-env.js';
import type { AccessTokenPayload } from '../common/types/auth.types.js';
import type { UserRole } from '../users/user-role.enum.js';

const TTL_PAR_DEFAUT_SECONDES = 15 * 60;

/** Sujet minimal nécessaire à la signature d'un access token. */
export interface TokenSubject {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Signe un access token de 15 minutes (contrat d'API) portant la session
   * (`sid`) : chaque requête pourra vérifier que la session n'a pas été
   * révoquée entre-temps (logout, changement de mot de passe, rejeu détecté).
   */
  async issue(
    subject: TokenSubject,
    sessionId: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const expiresIn = readPositiveInt(
      this.config.get<string>('JWT_ACCESS_TTL_SECONDS'),
      TTL_PAR_DEFAUT_SECONDES,
    );

    const payload: AccessTokenPayload = {
      sub: subject.id,
      sid: sessionId,
      role: subject.role,
      email: subject.email,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn,
      algorithm: 'HS256',
    });

    return { accessToken, expiresIn };
  }
}
