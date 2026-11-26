import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { ThrottleGuard } from './common/throttle/throttle.guard.js';
import { readPositiveInt } from './common/config/read-env.js';
import { validateEnvironment } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { User } from './users/user.entity.js';
import { UsersModule } from './users/users.module.js';

/**
 * Module racine.
 *
 * Ordre des gardes globaux :
 *   1. ThrottlerGuard — limite le débit AVANT toute vérification coûteuse
 *      (un attaquant n'obtient pas un bcrypt gratuit par requête) ;
 *   2. JwtAuthGuard   — authentification, sauf routes marquées @Public() ;
 *   3. RolesGuard     — RBAC, lit @Roles(...).
 * Le filtre global met toutes les erreurs au format du contrat d'API.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      validate: validateEnvironment,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST') ?? 'localhost',
        port: readPositiveInt(config.get<string>('DB_PORT'), 5433),
        username: config.get<string>('DB_USERNAME') ?? 'pk_manager',
        password: config.get<string>('DB_PASSWORD') ?? 'pk_manager_dev',
        database: config.get<string>('DB_NAME') ?? 'pk_manager',
        entities: [User],
        autoLoadEntities: true,
        // Jamais de synchronize en production : le schéma est géré par les
        // migrations (npm run db:setup).
        synchronize: config.get<string>('DB_SYNC') === 'true',
        logging: config.get<string>('DB_LOGGING') === 'true',
        retryAttempts: 10,
        retryDelay: 2000,
      }),
    }),

    UsersModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottleGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
