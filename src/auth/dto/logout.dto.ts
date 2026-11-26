import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Déconnexion mobile : le jeton voyage dans le corps. Web : cookie. */
export class LogoutDto {
  @IsOptional()
  @IsString({ message: 'Le refresh token doit être une chaîne de caractères.' })
  @MinLength(20, { message: 'Le refresh token est invalide.' })
  @MaxLength(200, { message: 'Le refresh token est invalide.' })
  refreshToken?: string;
}
