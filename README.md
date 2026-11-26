# pk-managment-backend

API de **P&K Business Manager**, application de gestion commerciale mono-boutique
(P&K Fashion and Tech). Sprint 1 : fondations et **authentification complète**.

- **NestJS 12** (ESM) · **PostgreSQL 16** · **TypeORM** (migrations, jamais `synchronize`)
- JWT (Passport) + refresh token **opaque à rotation**, RBAC `ADMIN` / `SELLER`
- `class-validator` / `class-transformer`, erreurs uniformes en français
- Swagger : <http://localhost:3000/api/docs> · Sonde : `GET /api/health`
- Tests : **Jest** (ESM), 23 tests unitaires

## Prérequis

- Node.js 22+
- Une base PostgreSQL 16 — le dépôt voisin `docker/` en fournit une
- npm (le `package-lock.json` est versionné)

## Démarrage

```bash
# 1. Base de données (dossier voisin « docker »)
cd ../docker && cp .env.example .env && docker compose up -d && cd -

# 2. API
cp .env.example .env      # JWT_ACCESS_SECRET : openssl rand -base64 48
npm install
npm run db:setup          # migrations + compte administrateur initial
npm run start:dev         # http://localhost:3000/api
```

Vérification immédiate :

```bash
curl http://localhost:3000/api/health
# {"status":"ok","info":{"database":{"status":"up"}},...}
```

Sans le dossier `docker/`, la même base en une commande :

```bash
docker run -d --name pk-managment-db \
  -e POSTGRES_USER=pk_manager -e POSTGRES_PASSWORD=pk_manager_dev \
  -e POSTGRES_DB=pk_manager -p 127.0.0.1:5433:5432 \
  -v pk-db-data:/var/lib/postgresql/data postgres:16-alpine
```

## Compte administrateur

Créé uniquement par `npm run db:seed`, à partir de `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` lus dans `.env` :

- `SEED_ADMIN_PASSWORD` vide ⇒ aucun compte n'est créé (pas de mot de passe par défaut) ;
- le seed est idempotent : relancé, il ne duplique pas l'administrateur ;
- politique appliquée : 8 à 128 caractères, au moins une lettre et un chiffre.

Identifiants du `.env.example` (développement) : `admin@pk.local` / `Admin1234`.
**À changer avant tout déploiement.**

## Variables d'environnement

Toutes sont documentées dans `.env.example`. L'API **refuse de démarrer** si la
configuration est invalide (secret absent ou trop court, TTL incohérent, port non
numérique) : une erreur de configuration ne doit pas devenir une faille silencieuse.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3000` | Port HTTP |
| `DB_HOST` / `DB_PORT` | `localhost` / `5433` | Hôte et port PostgreSQL |
| `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` | `pk_manager` / `pk_manager_dev` / `pk_manager` | Identifiants de la base |
| `DB_SYNC` | `false` | Ne jamais passer à `true` hors développement jetable |
| `DB_LOGGING` | `false` | Journalisation SQL |
| `JWT_ACCESS_SECRET` | — | **Obligatoire**, 32 caractères minimum |
| `JWT_ACCESS_TTL_SECONDS` | `900` | Durée de l'access token (15 min) |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Durée **absolue** d'une session |
| `COOKIE_SECURE` | vide | `Secure` forcé par défaut si `NODE_ENV=production` |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:8081` | Origines autorisées, séparées par des virgules |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | `60000` / `120` | Quota global par IP |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_FULLNAME` | — | Compte initial |

Les quotas spécifiques des routes d'authentification (login 5/min, refresh 30/min,
logout 30/min, changement de mot de passe 10/min) sont des constantes du code :
un décorateur est évalué avant la lecture de `.env`, une variable y serait inopérante.

## Scripts

| Script | Effet |
| --- | --- |
| `npm run start:dev` | Développement (`nest start --watch`, rechargement à chaud) |
| `npm run start` | Démarrage direct depuis les sources |
| `npm run build` puis `npm run start:prod` | Build `tsc` puis exécution de `dist/main.js` |
| `npm run typecheck` | Vérification de types sans émission |
| `npm run lint` | ESLint, `--max-warnings=0`, `any` interdit |
| `npm test` | Tests unitaires Jest (ESM) |
| `npm run test:watch` / `test:cov` | Mode veille / couverture |
| `npm run migration:run` / `migration:revert` | Migrations TypeORM |
| `npm run db:seed` | Crée l'administrateur initial |
| `npm run db:setup` | `migration:run` puis `db:seed` |

## Contrat d'API

Base `/api`, JSON, dates ISO 8601, identifiants UUID. Rôles : `ADMIN`, `SELLER`.

Objet utilisateur : `{ id, email, fullName, role }`.

| Méthode | Route | Accès | Réponse |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | public, `X-Client-Type` requis | `200 { accessToken, refreshToken?, expiresIn, user }` |
| `POST` | `/api/auth/refresh` | public (cookie ou corps) | `200` même forme, **nouveaux** jetons |
| `POST` | `/api/auth/logout` | public (cookie ou corps) | `204` |
| `POST` | `/api/auth/change-password` | Bearer | `204` |
| `GET` | `/api/auth/me` | Bearer | `200 { id, email, fullName, role }` |
| `GET` | `/api/me` | Bearer | Même objet (alias du contrat) |
| `GET` | `/api/health` | public | `200 { status: "ok", ... }` |

**En-tête `X-Client-Type`** obligatoire sur les routes d'authentification :

- `web` ⇒ refresh token dans un cookie `httpOnly; Secure (prod); SameSite=Lax;
  Path=/api/auth`, **absent du corps** ;
- `mobile` ⇒ refresh token dans le corps, renvoyé dans le corps au refresh.

Sans cet en-tête : `400` avec un message français (deviner la valeur poserait un cookie
illisible pour un client mobile — une panne silencieuse).

**Durées** : access token 15 min, session et refresh token 30 jours **absolus** (la
rotation ne prolonge pas la session). Chaque requête authentifiée vérifie en base que la
session n'est pas révoquée : un logout ou un rejeu coupe l'accès immédiatement.

**Rejeu** : présenter un refresh token déjà consommé révoque toute la session et renvoie
`401`.

**Format d'erreur** :

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Identifiants invalides.",
  "timestamp": "2026-11-26T09:12:44.512Z",
  "path": "/api/auth/login"
}
```

`message` est une chaîne ou un tableau de chaînes, toujours en français pour
l'utilisateur. Codes à gérer côté client : `400` validation, `401` non authentifié ou
session expirée, `403` rôle insuffisant, `429` trop de tentatives, `5xx`.

Le message de login est **identique** pour un email inconnu et un mauvais mot de passe
(`Identifiants invalides.`), et le temps de réponse est égalisé par un hash factice.

### Exemples

Client web (cookie) :

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Client-Type: web' \
  -c cookies.txt \
  -d '{"identifier":"admin@pk.local","password":"Admin1234","deviceId":"3f1b8f0e-1c1d-4d0e-9a8b-2c3d4e5f6a7b","deviceName":"Caisse"}'

curl -i -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt -H 'X-Client-Type: web'
```

Client mobile (corps) :

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Client-Type: mobile' \
  -d '{"identifier":"admin@pk.local","password":"Admin1234","deviceId":"3f1b8f0e-1c1d-4d0e-9a8b-2c3d4e5f6a7b"}'
```

Route protégée :

```bash
curl -s http://localhost:3000/api/me -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Architecture

```
src/
  main.ts              préfixe /api, cookie-parser, CORS, Swagger, pipes, filtres
  app.module.ts        assemblage des modules, gardes globales, throttler
  config/              validation des variables d'environnement au démarrage
  auth/                contrôleurs, service, sessions, refresh tokens, JWT, cookie, DTO
  users/               entité User, énumération des rôles, lecture des utilisateurs
  common/              filtre d'erreurs, gardes (JWT, rôles, débit), décorateurs, types
  database/            DataSource TypeORM, migration initiale, seed administrateur
  health/              sonde publique vérifiant la base
```

Règles de sécurité appliquées :

- access token vérifié **avec** sa session à chaque requête ;
- refresh token opaque (48 octets), haché en SHA-256, à usage unique, consommation
  atomique (`UPDATE ... WHERE used_at IS NULL`) ;
- cookie web `httpOnly` + `SameSite=Lax` + `Path=/api/auth`, `Secure` en production ;
- bcrypt coût 12, hash en `select: false` (jamais chargé ni sérialisé par accident) ;
- quotas anti force brute avec `429` + `Retry-After` ;
- `5xx` journalisés côté serveur, message générique côté client ;
- aucun secret dans le code : tout passe par `.env` (`.env.example` est le seul
  fichier d'environnement versionné).

## Tests

```bash
npm test            # 23 tests, 5 suites
npm run typecheck
npm run lint
```

Couverture fonctionnelle : politique de login uniforme, création de session, rotation,
rejeu (révocation de la session), appareil différent, changement de mot de passe, cookie
web vs corps mobile, quotas `429`, hachage et TTL des refresh tokens, garde JWT.

Un scénario d'intégration manuel (27 vérifications : migrations, seed, login web et
mobile, rotation, rejeu, logout, changement de mot de passe, `429`) a été exécuté contre
un PostgreSQL réel. Aucun test e2e automatisé n'est versionné.

## Limites connues du sprint 1

- Limitation de débit **en mémoire** : exacte en mono-instance seulement (Redis requis
  derrière plusieurs instances).
- Pas de révocation globale « tous les appareils » au-delà du changement de mot de passe.
- Pas de route `GET /api/users` : le `RolesGuard` est en place et testé en unitaire, mais
  aucune route `ADMIN` n'est encore exposée.
- Pas de mode hors ligne : sprints 6 à 8.

## Décisions et écarts

Le journal de décisions du projet est tenu dans le dossier partagé `docs/` du poste de
développement (`../docs/decisions.md`), hors de ce dépôt. Il documente notamment le
transport des jetons, les durées, les quotas, le choix ESM, et les **écarts assumés**
avec la pile prescrite (TypeORM au lieu de Prisma, bcrypt coût 12 au lieu d'Argon2id,
garde de débit maison au lieu de `@nestjs/throttler`, sonde maison au lieu de Terminus).
