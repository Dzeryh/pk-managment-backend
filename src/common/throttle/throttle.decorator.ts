import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle';

export interface ThrottleOptions {
  /** Nombre maximum de requêtes dans la fenêtre. */
  limit: number;
  /** Largeur de la fenêtre, en millisecondes. */
  ttlMs: number;
}

/** Applique un quota à une route (ex. 5 tentatives de connexion par minute et par IP). */
export const Throttle = (options: ThrottleOptions): CustomDecorator<string> =>
  SetMetadata(THROTTLE_KEY, options);
