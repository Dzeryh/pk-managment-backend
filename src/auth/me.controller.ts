import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser, PublicUser } from '../common/types/auth.types.js';
import { AuthService } from './auth.service.js';

/**
 * `GET /api/me` — objet utilisateur du contrat d'API.
 *
 * Route séparée du contrôleur d'authentification pour respecter exactement le
 * chemin du contrat (le préfixe global `/api` est ajouté par le bootstrap).
 */
@Controller()
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    return this.auth.me(user.id);
  }
}
