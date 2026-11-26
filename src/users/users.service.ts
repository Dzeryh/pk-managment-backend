import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PublicUser } from '../common/types/auth.types.js';
import { toPublicUser } from './user.mapper.js';
import { User } from './user.entity.js';

/** Colonnes explicitement sélectionnées quand le hash de mot de passe est nécessaire. */
const SELECTION_AVEC_HASH = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  passwordHash: true,
} as const;

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /**
   * Lecture réservée à l'authentification : c'est le seul chemin qui charge
   * `passwordHash` (colonne `select: false`).
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email },
      select: SELECTION_AVEC_HASH,
    });
  }

  /** Lecture avec hash, pour vérifier le mot de passe actuel. */
  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.users.findOne({
      where: { id },
      select: SELECTION_AVEC_HASH,
    });
  }

  /** Utilisateur public, ou null s'il n'existe plus. */
  async findPublicById(id: string): Promise<PublicUser | null> {
    const user = await this.users.findOne({ where: { id } });
    return user === null ? null : toPublicUser(user);
  }

  /** Met à jour le hash sans réécrire l'entité complète ni exposer le hash. */
  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.users.update({ id: userId }, { passwordHash });
  }
}
