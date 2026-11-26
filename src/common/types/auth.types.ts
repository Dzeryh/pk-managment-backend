import type { UserRole } from '../../users/user-role.enum.js';

/** Transport du refresh token, décidé par l'en-tête X-Client-Type. */
export type ClientType = 'web' | 'mobile';

/** Contenu signé de l'access token (15 minutes). */
export interface AccessTokenPayload {
  sub: string;
  sid: string;
  role: UserRole;
  email: string;
}

/** Utilisateur injecté par JwtStrategy après validation de la session. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

/** Objet utilisateur du contrat d'API. */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}
