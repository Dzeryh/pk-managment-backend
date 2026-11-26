import { validateEnvironment } from './env.validation.js';

/** Configuration minimale valide : tout le reste a une valeur par défaut. */
function configuration(surcharges: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    JWT_ACCESS_SECRET: 'x'.repeat(32),
    PORT: '3000',
    DB_PORT: '5433',
    JWT_ACCESS_TTL_SECONDS: '900',
    REFRESH_TOKEN_TTL_DAYS: '30',
    THROTTLE_LIMIT: '120',
    THROTTLE_TTL_MS: '60000',
    ...surcharges,
  };
}

describe('validateEnvironment', () => {
  it('convertit explicitement les chaînes numériques en nombres', () => {
    const env = validateEnvironment(configuration());

    expect(typeof env.PORT).toBe('number');
    expect(env.PORT).toBe(3000);
    expect(env.DB_PORT).toBe(5433);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(env.THROTTLE_LIMIT).toBe(120);
    expect(env.THROTTLE_TTL_MS).toBe(60_000);
  });

  it('refuse un port non numérique avec un message français', () => {
    expect(() => validateEnvironment(configuration({ PORT: 'abc' }))).toThrow(
      'PORT doit être un entier.',
    );
  });

  it('accepte un port vide (valeur par défaut du code)', () => {
    const env = validateEnvironment(configuration({ PORT: '' }));

    expect(env.PORT).toBeUndefined();
  });

  it('refuse une durée de jeton inférieure à 60 secondes', () => {
    expect(() =>
      validateEnvironment(configuration({ JWT_ACCESS_TTL_SECONDS: '30' })),
    ).toThrow('JWT_ACCESS_TTL_SECONDS doit être au moins 60 secondes.');
  });

  it('laisse COOKIE_SECURE sous forme de chaîne', () => {
    const env = validateEnvironment(configuration({ COOKIE_SECURE: 'false' }));

    expect(env.COOKIE_SECURE).toBe('false');
    expect(() => validateEnvironment(configuration({ COOKIE_SECURE: 'oui' }))).toThrow(
      'COOKIE_SECURE doit valoir true ou false.',
    );
  });
});
