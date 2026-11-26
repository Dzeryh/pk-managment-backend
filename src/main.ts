import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { collectValidationMessages } from './common/validation/validation-messages.js';

/**
 * Point d'entrée de l'API P&K Business Manager.
 *
 * - préfixe global `/api` (contrat d'API commun aux clients web et mobile) ;
 * - validation stricte des DTOs (champs inconnus refusés, messages en français) ;
 * - cookie-parser indispensable au refresh token des clients « web » ;
 * - helmet pour les en-têtes de sécurité de base ;
 * - CORS avec credentials (le cookie de refresh doit être accepté) et en-tête
 *   `X-Client-Type` explicitement autorisé.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());
  app.use(cookieParser());

  // Derrière un reverse proxy (production), `trust proxy` permet à Express de
  // voir le bon protocole/IP : sans cela, le cookie `Secure` et la limitation
  // de débit par IP seraient évalués sur la mauvaise connexion.
  if (config.get<string>('NODE_ENV') === 'production') {
    app.set('trust proxy', 1);
  }

  app.setGlobalPrefix('api');

  const origins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Type'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException(collectValidationMessages(errors)),
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('P&K Business Manager — API')
    .setDescription(
      "API de gestion commerciale mono-boutique. Authentification par access token Bearer, refresh token à usage unique (cookie pour le web, corps pour le mobile).",
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  app.enableShutdownHooks();

  const port = Number.parseInt(config.get<string>('PORT') ?? '3000', 10);
  await app.listen(Number.isFinite(port) ? port : 3000);
  logger.log(`API P&K démarrée sur http://localhost:${port}/api — documentation : /api/docs`);
}

void bootstrap();
