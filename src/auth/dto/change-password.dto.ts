import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'Le mot de passe actuel est requis.' })
  @MinLength(1, { message: 'Le mot de passe actuel est requis.' })
  @MaxLength(128, { message: 'Le mot de passe actuel est invalide.' })
  currentPassword!: string;

  @IsString({ message: 'Le nouveau mot de passe est requis.' })
  @MinLength(8, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' })
  @MaxLength(128, { message: 'Le nouveau mot de passe ne peut pas dépasser 128 caractères.' })
  @Matches(/[A-Za-z]/, { message: 'Le nouveau mot de passe doit contenir au moins une lettre.' })
  @Matches(/\d/, { message: 'Le nouveau mot de passe doit contenir au moins un chiffre.' })
  newPassword!: string;
}
