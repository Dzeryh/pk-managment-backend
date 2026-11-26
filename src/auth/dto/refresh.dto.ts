import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Corps attendu pour les clients « mobile ». Les clients « web » n'envoient
 * rien : leur refresh token vient du cookie httpOnly. Les champs restent donc
 * facultatifs ici, et AuthController applique la règle selon X-Client-Type.
 */
export class RefreshDto {
  @IsOptional()
  @IsString({ message: 'Le refresh token doit être une chaîne de caractères.' })
  @MinLength(20, { message: 'Le refresh token est invalide.' })
  @MaxLength(200, { message: 'Le refresh token est invalide.' })
  refreshToken?: string;

  @IsOptional()
  @IsUUID('4', { message: "L'identifiant de l'appareil doit être un UUID v4." })
  deviceId?: string;
}
