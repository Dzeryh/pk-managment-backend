import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ClientType } from '../common/types/auth.types.js';
import { User } from '../users/user.entity.js';

/**
 * Session = une connexion depuis un appareil.
 *
 * Elle porte l'échéance ABSOLUE de la session (30 jours à compter du login) :
 * la rotation des refresh tokens ne la prolonge pas indéfiniment, ce qui borne
 * la durée de vie d'un jeton volé.
 */
@Entity('auth_sessions')
@Index('idx_auth_sessions_user_id', ['userId'])
export class AuthSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId!: string;

  @Column({ name: 'device_name', type: 'varchar', length: 120, nullable: true })
  deviceName!: string | null;

  @Column({ name: 'client_type', type: 'varchar', length: 10 })
  clientType!: ClientType;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
