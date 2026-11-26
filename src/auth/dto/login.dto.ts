import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: "L'identifiant doit être une adresse e-mail valide." })
  @MaxLength(180, { message: "L'identifiant ne peut pas dépasser 180 caractères." })
  identifier!: string;

  @IsString({ message: 'Le mot de passe est requis.' })
  @MinLength(1, { message: 'Le mot de passe est requis.' })
  @MaxLength(128, { message: 'Le mot de passe ne peut pas dépasser 128 caractères.' })
  password!: string;

  @IsUUID('4', { message: "L'identifiant de l'appareil doit être un UUID v4." })
  deviceId!: string;

  @IsOptional()
  @IsString({ message: "Le nom de l'appareil doit être une chaîne de caractères." })
  @MaxLength(120, { message: "Le nom de l'appareil ne peut pas dépasser 120 caractères." })
  deviceName?: string;
}
