import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';
import type { UserRole } from '../../users/user-role.enum.js';

export const ROLES_KEY = 'roles';

/** Restreint une route à un ou plusieurs rôles. Sans décorateur : tout utilisateur authentifié. */
export const Roles = (...roles: UserRole[]): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);
