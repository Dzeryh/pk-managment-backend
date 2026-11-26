import type { ValidationError } from '@nestjs/common';

/**
 * Aplatit les erreurs de class-validator en une liste de messages français.
 *
 * Les DTOs portent leurs propres messages ; seuls les champs inconnus (règle
 * `forbidNonWhitelisted`) produisent un message générique anglais, traduit ici.
 */
export function collectValidationMessages(errors: ValidationError[], parent = ''): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const chemin = parent.length > 0 ? `${parent}.${error.property}` : error.property;

    if (error.constraints?.whitelistValidation !== undefined) {
      messages.push(`Le champ « ${chemin} » n'est pas autorisé.`);
      continue;
    }

    if (error.constraints !== undefined) {
      messages.push(...Object.values(error.constraints));
    }

    if (error.children !== undefined && error.children.length > 0) {
      messages.push(...collectValidationMessages(error.children, chemin));
    }
  }

  return messages.length > 0 ? messages : ['Requête invalide.'];
}
