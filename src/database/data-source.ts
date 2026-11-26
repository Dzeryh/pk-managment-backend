import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AuthRefreshToken } from '../auth/auth-refresh-token.entity.js';
import { AuthSession } from '../auth/auth-session.entity.js';
import { User } from '../users/user.entity.js';
import { CreateAuthSchema1735689600000 } from './migrations/1735689600000-create-auth-schema.js';

/**
 * Source de données unique, utilisée par l'application ET par la CLI TypeORM.
 *
 * `synchronize` est toujours false ici : le schéma évolue par migrations
 * versionnées (voir `npm run db:setup`).
 */
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number.parseInt(process.env.DB_PORT ?? '5433', 10),
  username: process.env.DB_USERNAME ?? 'pk_manager',
  password: process.env.DB_PASSWORD ?? 'pk_manager_dev',
  database: process.env.DB_NAME ?? 'pk_manager',
  entities: [User, AuthSession, AuthRefreshToken],
  migrations: [CreateAuthSchema1735689600000],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});

// Un SEUL export de DataSource : la CLI TypeORM refuse un module qui en
// exporterait plusieurs. Les scripts importent cet export par défaut.
export default AppDataSource;
