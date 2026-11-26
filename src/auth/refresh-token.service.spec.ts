import { ConfigService } from '@nestjs/config';
import { RefreshTokenService } from './refresh-token.service.js';

function configAvec(valeurs: Record<string, string>): ConfigService {
  return {
    get: (cle: string) => valeurs[cle],
  } as unknown as ConfigService;
}

describe('RefreshTokenService', () => {
  const service = new RefreshTokenService(configAvec({ REFRESH_TOKEN_TTL_DAYS: '30' }));

  it('génère des jetons opaques, uniques et sûrs pour une URL', () => {
    const premier = service.generate();
    const second = service.generate();

    expect(premier).not.toBe(second);
    expect(premier.length).toBeGreaterThanOrEqual(60);
    expect(premier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hache de façon déterministe en SHA-256 (64 caractères hexadécimaux)', () => {
    const jeton = 'jeton-de-test';
    const empreinte = service.hash(jeton);

    expect(empreinte).toBe(service.hash(jeton));
    expect(empreinte).toMatch(/^[a-f0-9]{64}$/);
    expect(empreinte).not.toBe(service.hash('autre-jeton'));
  });

  it('calcule une échéance absolue à 30 jours', () => {
    const maintenant = new Date('2026-01-01T00:00:00.000Z');
    const echeance = service.expiresAtFrom(maintenant);
    const jours = (echeance.getTime() - maintenant.getTime()) / (24 * 60 * 60 * 1000);

    expect(jours).toBe(30);
    expect(service.ttlMs).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
