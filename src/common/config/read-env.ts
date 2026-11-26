/**
 * Lecture d'un entier positif depuis la configuration, avec repli sûr.
 *
 * `ConfigService.get` renvoie parfois la chaîne brute (variable d'environnement
 * absente du schéma validé) et parfois un nombre (valeur transformée par
 * `validateEnvironment`). Sans ce garde-fou, un `Number('')` donnerait 0 et une
 * limite de débit nulle bloquerait toutes les requêtes.
 */
export function readPositiveInt(value: string | number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Lecture d'un booléen de configuration (« true » strictement), avec repli. */
export function readBoolean(value: string | boolean | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value.trim() === '') {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}
