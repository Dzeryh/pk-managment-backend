import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { UserRole } from '../users/user-role.enum.js';
import { User } from '../users/user.entity.js';
import { BCRYPT_ROUNDS } from '../auth/auth.constants.js';
import AppDataSource from './data-source.js';

/**
 * Crée (ou met à jour) le compte administrateur de démarrage.
 *
 * Aucun mot de passe n'est écrit dans le code : il vient de
 * SEED_ADMIN_PASSWORD. Sans email/mot de passe, le script ne crée rien et
 * l'annonce — un seed ne doit jamais inventer d'identifiants.
 */
async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_FULLNAME?.trim() || 'Administrateur P&K';

  if (email === undefined || email.length === 0 || password === undefined || password.length === 0) {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD absents : aucun compte administrateur créé.');
    return;
  }

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error(
      'SEED_ADMIN_PASSWORD doit contenir au moins 8 caractères, une lettre et un chiffre.',
    );
  }

  await AppDataSource.initialize();

  try {
    const users = AppDataSource.getRepository(User);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const existing = await users.findOne({ where: { email } });

    if (existing === null) {
      await users.save(
        users.create({
          email,
          fullName,
          role: UserRole.ADMIN,
          passwordHash,
          isActive: true,
        }),
      );
      console.log(`Compte administrateur créé : ${email}`);
      return;
    }

    await users.update(
      { id: existing.id },
      { fullName, role: UserRole.ADMIN, passwordHash, isActive: true },
    );
    console.log(`Compte administrateur mis à jour : ${email}`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('Seed impossible :', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
