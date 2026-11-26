import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuthSession } from './auth-session.entity.js';

/**
 * Refresh token à usage unique.
 *
 * Seul le SHA-256 du jeton est stocké : une fuite de la base ne donne aucun
 * jeton utilisable. La ligne reste en base après consommation (`used_at`) pour
 * permettre la DÉTECTION DU REJEU : présenter un jeton déjà consommé prouve
 * qu'il a été copié, et toute la session est alors révoquée.
 */
@Entity('auth_refresh_tokens')
@Index('uq_auth_refresh_tokens_token_hash', ['tokenHash'], { unique: true })
@Index('idx_auth_refresh_tokens_session_id', ['sessionId'])
export class AuthRefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @ManyToOne(() => AuthSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: AuthSession;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
