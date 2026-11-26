import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Route accessible sans access token (login, refresh, logout, health). */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);
