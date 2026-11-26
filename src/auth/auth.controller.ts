import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClientType } from '../common/decorators/client-type.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Throttle } from '../common/throttle/throttle.decorator.js';
import type { AuthenticatedUser, ClientType as ClientTypeValue, PublicUser } from '../common/types/auth.types.js';
import { AUTH_THROTTLES, MESSAGE_SESSION_INVALIDE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { AuthResult } from './auth.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { LogoutDto } from './dto/logout.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RefreshCookieService } from './refresh-cookie.service.js';

/** Réponse du contrat : `refreshToken` n'apparaît QUE pour un client mobile. */
export interface AuthResponseBody {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: PublicUser;
}

type RequeteAvecCookies = Request & { cookies?: Record<string, unknown> };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: RefreshCookieService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle(AUTH_THROTTLES.login)
  async login(
    @Body() dto: LoginDto,
    @ClientType() clientType: ClientTypeValue,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseBody> {
    const result = await this.auth.login(dto, clientType);
    return this.expose(result, clientType, response);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle(AUTH_THROTTLES.refresh)
  async refresh(
    @Body() dto: RefreshDto,
    @ClientType() clientType: ClientTypeValue,
    @Req() request: RequeteAvecCookies,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseBody> {
    const refreshToken = this.readRefreshToken(request, dto, clientType);
    const result = await this.auth.refresh(refreshToken, dto.deviceId, clientType);
    return this.expose(result, clientType, response);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(AUTH_THROTTLES.logout)
  async logout(
    @Body() dto: LogoutDto,
    @ClientType() clientType: ClientTypeValue,
    @Req() request: RequeteAvecCookies,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken =
      clientType === 'web'
        ? this.readCookie(request)
        : (dto.refreshToken ?? null);

    await this.auth.logout(refreshToken);
    this.cookies.clear(response);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(AUTH_THROTTLES.changePassword)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(user.id, user.sessionId, dto);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    return this.auth.me(user.id);
  }

  /**
   * Met en forme la réponse selon le client : cookie httpOnly pour le web,
   * jeton dans le corps pour le mobile. Un client mobile reçoit en plus un
   * effacement de cookie, pour ne pas laisser traîner une session web.
   */
  private expose(result: AuthResult, clientType: ClientTypeValue, response: Response): AuthResponseBody {
    if (clientType === 'web') {
      this.cookies.set(response, result.tokens.refreshToken);
      return {
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
        user: result.user,
      };
    }

    this.cookies.clear(response);
    return {
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresIn: result.tokens.expiresIn,
      user: result.user,
    };
  }

  private readCookie(request: RequeteAvecCookies): string | null {
    const valeur = request.cookies?.[RefreshCookieService.NAME];
    return typeof valeur === 'string' && valeur.length > 0 ? valeur : null;
  }

  /** Web : cookie obligatoire. Mobile : refreshToken + deviceId obligatoires. */
  private readRefreshToken(
    request: RequeteAvecCookies,
    dto: RefreshDto,
    clientType: ClientTypeValue,
  ): string {
    if (clientType === 'web') {
      const cookie = this.readCookie(request);
      if (cookie === null) {
        throw new UnauthorizedException(MESSAGE_SESSION_INVALIDE);
      }
      return cookie;
    }

    if (dto.refreshToken === undefined) {
      throw new BadRequestException('Le refresh token est requis pour un client mobile.');
    }

    if (dto.deviceId === undefined) {
      throw new BadRequestException("L'identifiant de l'appareil est requis pour un client mobile.");
    }

    return dto.refreshToken;
  }
}
