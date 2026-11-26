import type { PublicUser } from '../common/types/auth.types.js';
import type { UserRole } from './user-role.enum.js';

/** Champs strictement nécessaires à l'objet utilisateur du contrat d'API. */
interface UtilisateurMappable {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

/** Projection publique : ne laisse jamais fuiter le hash ni les colonnes techniques. */
export function toPublicUser(user: UtilisateurMappable): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}
