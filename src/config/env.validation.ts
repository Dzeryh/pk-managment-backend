import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/** Variable vide (`KEY=`) → absence, pour que @IsOptional s'applique. */
const VideEnAbsent = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value));

/**
 * Convertit explicitement en nombre (ne dépend pas des métadonnées de
 * décorateurs, contrairement à `enableImplicitConversion`). Vide → absent.
 * Valeur invalide → NaN,
 * que @IsInt rejette avec le message prévu.
 */
const EntierDepuisEnv = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    if (typeof value === 'number') return value;
    return Number(value);
  });

export class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'test', 'production'], {
    message: 'NODE_ENV doit valoir development, test ou production.',
  })
  NODE_ENV?: string;

  @IsOptional()
  @EntierDepuisEnv()
  @IsInt({ message: 'PORT doit être un entier.' })
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @EntierDepuisEnv()
  @IsInt({ message: 'THROTTLE_TTL_MS doit être un entier.' })
  @Min(1000)
  THROTTLE_TTL_MS?: number;

  @IsOptional()
  @IsString()
  DB_HOST?: string;

  @IsOptional()
  @EntierDepuisEnv()
  @IsInt({ message: 'DB_PORT doit être un entier.' })
  @Min(1)
  @Max(65535)
  DB_PORT?: number;

  @IsOptional()
  @IsString()
  DB_USERNAME?: string;

  @IsOptional()
  @IsString()
  DB_PASSWORD?: string;

  @IsOptional()
  @IsString()
  DB_NAME?: string;

  @IsString({ message: 'JWT_ACCESS_SECRET est obligatoire.' })
  @MinLength(32, { message: 'JWT_ACCESS_SECRET doit contenir au moins 32 caractères.' })
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @EntierDepuisEnv()
  @IsInt({ message: 'JWT_ACCESS_TTL_SECONDS doit être un entier.' })
  @Min(60, { message: 'JWT_ACCESS_TTL_SECONDS doit être au moins 60 secondes.' })
  @Max(86_400)
  JWT_ACCESS_TTL_SECONDS?: number;

  @IsOptional()
  @EntierDepuisEnv()
  @IsInt({ message: 'REFRESH_TOKEN_TTL_DAYS doit être un entier.' })
  @Min(1)
  @Max(365)
  REFRESH_TOKEN_TTL_DAYS?: number;

  @IsOptional()
  @VideEnAbsent()
  @IsIn(['true', 'false'], { message: 'COOKIE_SECURE doit valoir true ou false.' })
  COOKIE_SECURE?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsOptional()
  @EntierDepuisEnv()
  @IsInt({ message: 'THROTTLE_LIMIT doit être un entier.' })
  @Min(1)
  THROTTLE_LIMIT?: number;

  @IsOptional()
  @IsString()
  SEED_ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'SEED_ADMIN_PASSWORD doit contenir au moins 8 caractères.' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'SEED_ADMIN_PASSWORD doit contenir au moins une lettre et un chiffre.',
  })
  SEED_ADMIN_PASSWORD?: string;

  @IsOptional()
  @IsString()
  SEED_ADMIN_FULLNAME?: string;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const instance = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: false,
  });

  const errors = validateSync(instance, { skipMissingProperties: false, whitelist: false });
  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join(' ');
    throw new Error(`Configuration d'environnement invalide : ${details}`);
  }

  return instance;
}
