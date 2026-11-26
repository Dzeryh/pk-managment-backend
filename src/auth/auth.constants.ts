/**
 * Quotas de débit des routes d'authentification.
 *
 * Valeurs fixes dans le code (et non en variables d'environnement) : un
 * décorateur @Throttle est évalué au chargement du module, AVANT que
 * ConfigModule n'ait lu `.env` — une valeur d'environnement y serait donc
 * silencieusement ignorée. Le quota global, lui, reste configurable
 * (THROTTLE_LIMIT / THROTTLE_TTL_MS dans AppModule).
 */
export const AUTH_THROTTLES = {
  login: { limit: 5, ttlMs: 60_000 },
  refresh: { limit: 30, ttlMs: 60_000 },
  logout: { limit: 30, ttlMs: 60_000 },
  changePassword: { limit: 10, ttlMs: 60_000 },
} as const;

/** Message UNIQUE de login (email inconnu, mauvais mot de passe, compte inactif). */
export const MESSAGE_IDENTIFIANTS_INVALIDES = 'Identifiants invalides.';

/** Message UNIQUE de refresh invalide/expiré/rejoué. */
export const MESSAGE_SESSION_INVALIDE = 'Session expirée. Veuillez vous reconnecter.';

/** Coût bcrypt (2^12 tours) : compromis standard entre sécurité et latence. */
export const BCRYPT_ROUNDS = 12;
