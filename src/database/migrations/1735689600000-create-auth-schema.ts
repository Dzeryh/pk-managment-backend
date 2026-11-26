import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schéma initial (sprint 1) : utilisateurs, sessions, refresh tokens.
 *
 * `gen_random_uuid()` vient de pgcrypto (inclus dans PostgreSQL 13+) : pas
 * besoin de l'extension uuid-ossp.
 */
export class CreateAuthSchema1735689600000 implements MigrationInterface {
  name = 'CreateAuthSchema1735689600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(`CREATE TYPE "user_role" AS ENUM ('ADMIN', 'SELLER')`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(180) NOT NULL,
        "full_name" varchar(120) NOT NULL,
        "role" "user_role" NOT NULL DEFAULT 'SELLER',
        "password_hash" varchar(100) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "device_id" uuid NOT NULL,
        "device_name" varchar(120),
        "client_type" varchar(10) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_auth_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "ck_auth_sessions_client_type" CHECK ("client_type" IN ('web', 'mobile'))
      )
    `);
    await queryRunner.query('CREATE INDEX "idx_auth_sessions_user_id" ON "auth_sessions" ("user_id")');

    await queryRunner.query(`
      CREATE TABLE "auth_refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "session_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_auth_refresh_tokens_session" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_auth_refresh_tokens_token_hash" UNIQUE ("token_hash")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_auth_refresh_tokens_session_id" ON "auth_refresh_tokens" ("session_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_auth_refresh_tokens_session_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "auth_refresh_tokens"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_auth_sessions_user_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "auth_sessions"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
    await queryRunner.query('DROP TYPE IF EXISTS "user_role"');
  }
}
