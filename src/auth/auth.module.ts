import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity.js';
import { UsersModule } from '../users/users.module.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthRefreshToken } from './auth-refresh-token.entity.js';
import { AuthSession } from './auth-session.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { MeController } from './me.controller.js';
import { RefreshCookieService } from './refresh-cookie.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuthSession, AuthRefreshToken]),
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { algorithm: 'HS256' as const },
      }),
    }),
    UsersModule,
  ],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    AccessTokenService,
    RefreshTokenService,
    RefreshCookieService,
    JwtStrategy,
  ],
  exports: [AuthService, AccessTokenService],
})
export class AuthModule {}
