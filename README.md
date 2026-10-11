# Teranga Fleet

SaaS multi-tenant de gestion de flotte de véhicules, conçu pour le marché sénégalais et
ouest-africain : entreprises disposant de véhicules de service, transporteurs, loueurs, PME/PMI,
ONG et sociétés de livraison.

> **État d'avancement : backend complet (phases 1 à 13).** API REST multi-tenant testée
> (unitaires + e2e sur PostgreSQL). Le dashboard web (étape 4) et l'application mobile
> (étape 5) restent à réaliser. Ce README est complété à chaque étape.

## Architecture

Monorepo [pnpm workspaces](https://pnpm.io/workspaces) :

```
apps/
  api/        API REST NestJS 11 (TypeScript, CommonJS, Prisma 7, Jest)
  web/        Dashboard gestionnaire / administrateur Next.js 16 (App Router, Tailwind CSS 4)
  mobile/     Application chauffeur React Native / Expo SDK 57 (Expo Router)
packages/
  shared/     Types et constantes partagés (rôles, statuts, format d'erreur, pagination)
```

- Chaque application est indépendante (ses propres dépendances, scripts, configuration ESLint).
- `@teranga-fleet/shared` est compilé en CommonJS dans `packages/shared/dist`, ce qui le rend
  consommable tel quel par Node (API), Next.js et Metro. Ses enums sont identiques à ceux du schéma
  Prisma : un test de l'API échoue si l'un est modifié sans l'autre.
- Après chaque `pnpm install`, le script `postinstall` compile `shared` et génère le client Prisma.

### Choix techniques

| Sujet             | Choix                                      | Raison                                                                                                             |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Version de NestJS | 11 (et non 12)                             | Nest 12 ne fonctionne qu'en ESM, ce qui complique Jest, demandé par le cahier des charges. Nest 11 reste maintenu. |
| TypeScript        | 6.0                                        | TypeScript 7 n'est pas encore pris en charge par ts-jest ni typescript-eslint.                                     |
| ESLint            | 9 (flat config)                            | Version prise en charge par les configurations Next.js et Expo.                                                    |
| Prisma            | 7.10 (dernière version stable)             | Générateur `prisma-client` en CommonJS, adaptateur `@prisma/adapter-pg`.                                           |
| Mots de passe     | argon2id                                   | Algorithme recommandé par l'OWASP.                                                                                 |
| Formatage         | Prettier, configuration unique à la racine |                                                                                                                    |

## Multi-tenant et intégrité des données

Le multi-tenant est une règle de conception : le `companyId` est toujours dérivé de l'utilisateur
authentifié (JWT), jamais d'une valeur envoyée par le client. La base le garantit aussi :

- Chaque table métier (documents, entretiens, affectations, relevés, incidents) porte directement
  un `companyId`, ce qui permet un filtrage uniforme et indexé.
- Les liens vers un véhicule ou un chauffeur sont des **clés étrangères composites**
  `(vehicleId, companyId)` et `(driverId, companyId)`. Il est donc impossible, même par erreur
  dans le code, de rattacher un document d'une entreprise au véhicule d'une autre.
- Le hash du mot de passe est exclu de **toutes** les requêtes Prisma par défaut (option `omit`).
  Seul le login le demandera explicitement.

Contraintes vérifiées par PostgreSQL :

| Règle                                                       | Mécanisme                                   |
| ----------------------------------------------------------- | ------------------------------------------- |
| Un véhicule n'a qu'une affectation en cours                 | Index unique partiel (`dateFin IS NULL`)    |
| Un chauffeur ne conduit qu'un véhicule à la fois            | Index unique partiel (`dateFin IS NULL`)    |
| Immatriculation unique par entreprise                       | `UNIQUE (companyId, immatriculation)`       |
| Numéro de permis unique par entreprise                      | `UNIQUE (companyId, numeroPermis)`          |
| Email utilisateur unique sur toute la plateforme            | `UNIQUE (email)`                            |
| Seul un ADMIN de la plateforme n'a pas d'entreprise         | `CHECK`                                     |
| Fin d'affectation postérieure au début                      | `CHECK`                                     |
| Expiration d'un document postérieure à son émission         | `CHECK`                                     |
| Kilométrages et coûts positifs, prochain entretien cohérent | `CHECK`                                     |
| Un chauffeur avec un historique ne peut pas être supprimé   | Clé étrangère `NO ACTION` (on le désactive) |

La règle « un nouveau relevé ne peut pas être inférieur au kilométrage actuel » dépend de l'état
du véhicule. Elle est appliquée par l'API dans une transaction (phase 9).

### Modèle de données

`Company`, `User`, `Vehicle`, `Driver`, `Assignment`, `Document`, `MaintenanceRecord`,
`MileageLog`, `Incident`. Voir [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma).
Le statut d'un document (`VALIDE`, `EXPIRANT_BIENTOT`, `EXPIRE`) n'est pas stocké : il est calculé
à partir de sa date d'expiration. Les coûts sont en francs CFA (XOF), sans décimales.

## Prérequis

- Node.js ≥ 20.19 (22 LTS recommandé, voir `.nvmrc`)
- pnpm 11 (`corepack enable` ou `npm i -g pnpm`)
- Docker (pour PostgreSQL), ou un PostgreSQL 16+ existant
- Pour le mobile : l'application Expo Go sur un téléphone, ou un émulateur Android / simulateur iOS

## Installation

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

### Base de données

```bash
pnpm db:up        # démarre le conteneur teranga-postgres (PostgreSQL 17, port 5436)
pnpm db:migrate   # applique les migrations
pnpm db:seed      # charge les données de démonstration
```

Le conteneur utilise un volume Docker dédié (`teranga-postgres-data`). Les identifiants par défaut
de `docker-compose.yml` sont réservés au développement local. Ils sont surchargeables avec les
variables `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` et `POSTGRES_PORT`.

| Script            | Effet                                                                         |
| ----------------- | ----------------------------------------------------------------------------- |
| `pnpm db:up`      | Démarre PostgreSQL et attend qu'il soit prêt                                  |
| `pnpm db:down`    | Arrête le conteneur (les données sont conservées)                             |
| `pnpm db:migrate` | `prisma migrate dev` : applique les migrations, en crée si le schéma a changé |
| `pnpm db:seed`    | Recrée l'entreprise de démonstration (idempotent)                             |
| `pnpm db:reset`   | Supprime la base, réapplique toutes les migrations, relance le seed           |
| `pnpm db:studio`  | Ouvre Prisma Studio pour explorer les données                                 |

En production, appliquer les migrations avec `pnpm --filter @teranga-fleet/api prisma:deploy`.

> Certaines contraintes (index partiels, `CHECK`) ont été ajoutées à la main dans la migration
> initiale. Pour une future migration qui en a besoin, la créer avec
> `prisma migrate dev --create-only`, compléter le SQL, puis l'appliquer.

### Comptes de développement

Le seed crée l'entreprise **Teranga Logistique SARL** (Dakar), son gestionnaire, deux chauffeurs
avec un compte mobile, trois véhicules et leur historique : documents, entretiens, affectations,
relevés kilométriques, incidents. Les dates sont relatives au jour du seed, si bien que les cas
d'alerte existent toujours : assurance qui expire dans 12 jours, vignette expirée, permis qui
expire dans 21 jours, révision dépassée au kilométrage, entretien à prévoir dans 20 jours.

| Rôle         | Email                                     |
| ------------ | ----------------------------------------- |
| ADMIN        | `admin@teranga-fleet.example`             |
| GESTIONNAIRE | `gestionnaire@teranga-logistique.example` |
| CHAUFFEUR    | `moussa.diop@teranga-logistique.example`  |
| CHAUFFEUR    | `aminata.sow@teranga-logistique.example`  |

Aucun mot de passe n'est versionné. Tous les comptes utilisent `SEED_PASSWORD` (dans
`apps/api/.env`). Si cette variable est vide, le seed génère un mot de passe aléatoire et
l'affiche à la fin de son exécution. Le seed refuse de s'exécuter si `NODE_ENV=production`.

## Variables d'environnement

Seuls les fichiers `.env.example` sont versionnés. Aucun secret ne doit être commité.

### API (`apps/api/.env`)

| Variable                                                                  | Description                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                | `development`, `test` ou `production`                                           |
| `PORT`                                                                    | Port HTTP de l'API (4000 par défaut)                                            |
| `CORS_ORIGINS`                                                            | Origines autorisées, séparées par des virgules. Obligatoire en production.      |
| `DATABASE_URL`                                                            | Chaîne de connexion PostgreSQL (obligatoire)                                    |
| `SEED_PASSWORD`                                                           | Mot de passe des comptes de démonstration (optionnel)                           |
| `JWT_SECRET` / `JWT_EXPIRES_IN`                                           | Signature et durée de validité des tokens (phase 3)                             |
| `STORAGE_DRIVER`                                                          | `local` (développement) ou `s3` (production) (phase 6)                          |
| `UPLOAD_DIR` / `UPLOAD_MAX_SIZE_MB`                                       | Dossier de stockage local et taille maximale des fichiers                       |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION` | Stockage S3-compatible                                                          |
| `ALERT_THRESHOLD_DAYS`                                                    | Seuil des alertes « expire bientôt » et « entretien à prévoir » (30 par défaut) |
| `MAINTENANCE_KM_MARGIN`                                                   | Marge en km avant une échéance d'entretien kilométrique (1000 par défaut)       |
| `AUTH_RATE_LIMIT`                                                         | Tentatives de login / inscription par minute et par IP (10 par défaut)          |
| `SWAGGER_ENABLED`                                                         | Active la documentation sur /docs (par défaut : hors production uniquement)     |

L'API valide sa configuration au démarrage et refuse de démarrer si elle est invalide.

### Web (`apps/web/.env.local`)

| Variable              | Description                         |
| --------------------- | ----------------------------------- |
| `NEXT_PUBLIC_API_URL` | URL de l'API, exposée au navigateur |

### Mobile (`apps/mobile/.env`)

| Variable              | Description                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | URL de l'API vue depuis l'appareil (`http://10.0.2.2:4000` pour l'émulateur Android, IP locale du PC pour un téléphone physique) |

## Lancement en développement

```bash
pnpm db:up        # PostgreSQL
pnpm dev:api      # API sur http://localhost:4000 (GET /health vérifie aussi la base)
pnpm dev:web      # Dashboard sur http://localhost:3001
pnpm dev:mobile   # Serveur Expo : scanner le QR code avec Expo Go
```

## Scripts de la racine

| Script                                          | Effet                                                  |
| ----------------------------------------------- | ------------------------------------------------------ |
| `pnpm build`                                    | Compile `shared`, l'API et le web                      |
| `pnpm lint`                                     | ESLint sur toutes les applications                     |
| `pnpm typecheck`                                | Vérification TypeScript sur tout le monorepo           |
| `pnpm test`                                     | Tests unitaires (Jest)                                 |
| `pnpm --filter @teranga-fleet/api test:e2e`     | Tests end-to-end de l'API (PostgreSQL doit être lancé) |
| `pnpm --filter @teranga-fleet/api test:e2e:cov` | Tests end-to-end avec rapport de couverture            |
| `pnpm format` / `pnpm format:check`             | Formatage Prettier                                     |

## API

### Swagger

Documentation interactive sur **http://localhost:4000/docs** (JSON : `/docs-json`). Se
connecter via `POST /auth/login`, puis cliquer sur « Authorize » et coller le token. Swagger est
actif par défaut hors production ; en production, l'activer explicitement avec
`SWAGGER_ENABLED=true`.

### Authentification et rôles

Toutes les routes exigent un JWT (`Authorization: Bearer <token>`), sauf `/health`,
`/auth/login` et `/auth/register-company` (limitées à `AUTH_RATE_LIMIT` tentatives par minute et
par IP). Chaque route déclare les rôles autorisés ; une route qui n'en déclare pas est refusée à
tous (sécurité par défaut).

| Rôle         | Accès                                                                                 |
| ------------ | ------------------------------------------------------------------------------------- |
| GESTIONNAIRE | Toute la flotte de son entreprise                                                     |
| CHAUFFEUR    | Son profil, son véhicule affecté, ses relevés et ses incidents, ses alertes           |
| ADMIN        | Statistiques globales et entreprises (`/admin/*`) ; aucun accès aux données de flotte |

Une ressource d'une autre entreprise renvoie toujours **404**, comme une ressource inexistante.

### Endpoints principaux

| Domaine      | Endpoints                                                                                                                 | Rôles                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Auth         | `POST /auth/register-company`, `POST /auth/login`, `GET /auth/me`                                                         | public / tous           |
| Véhicules    | `POST/GET /vehicles`, `GET/PATCH/DELETE /vehicles/:id` — filtres `search`, `status`, `alerts`, pagination `page`/`limit`  | gestionnaire            |
| Chauffeurs   | `POST/GET /drivers`, `GET/PATCH/DELETE /drivers/:id`, `PUT /drivers/:id/account` — filtres `search`, `statut`, `permis`   | gestionnaire            |
|              | `GET /drivers/me`, `GET /drivers/me/mileage`                                                                              | chauffeur               |
| Documents    | `POST/GET /vehicles/:vehicleId/documents`, `GET /documents`, `GET/PATCH/DELETE /documents/:id`, `GET /documents/:id/file` | gestionnaire            |
| Maintenance  | `POST/GET /maintenance`, `GET /maintenance/due`, `GET/PATCH/DELETE /maintenance/:id`                                      | gestionnaire            |
| Affectations | `POST/GET /assignments`, `GET/PATCH /assignments/:id`, `POST /assignments/:id/end`                                        | gestionnaire            |
| Kilométrage  | `POST /mileage`                                                                                                           | chauffeur, gestionnaire |
|              | `GET /vehicles/:vehicleId/mileage`                                                                                        | gestionnaire            |
| Incidents    | `POST/GET /incidents`, `GET /incidents/:id`, `POST/GET /incidents/:id/photo`                                              | chauffeur, gestionnaire |
|              | `PATCH /incidents/:id` (statut, gravité, notes, clôture)                                                                  | gestionnaire            |
| Alertes      | `GET /alerts` — filtres `vehicleId`, `severity`, `type`                                                                   | gestionnaire, chauffeur |
| Dashboard    | `GET /dashboard/summary`, `GET /dashboard/maintenance-costs?months=6`                                                     | gestionnaire            |
| Admin        | `GET /admin/stats`, `GET /admin/companies`, `GET /admin/companies/:id`                                                    | admin                   |

Uploads (`multipart/form-data`) : champ `fichier` pour les documents (PDF, JPG, PNG), champ
`photo` pour les incidents (JPG, PNG). Le type réel est vérifié par la signature du fichier, la
taille est limitée par `UPLOAD_MAX_SIZE_MB`, et les fichiers ne sont jamais servis publiquement.

### Format des erreurs

```json
{
  "statusCode": 400,
  "error": "MILEAGE_TOO_LOW",
  "message": "Le kilométrage saisi (500 km) est inférieur au kilométrage actuel du véhicule (1 000 km)"
}
```

`message` est en français et affichable tel quel. `error` est un code stable (`VALIDATION_ERROR`,
`INVALID_CREDENTIALS`, `NOT_FOUND`, `CONFLICT`, `VEHICLE_UNAVAILABLE`, `DRIVER_UNAVAILABLE`,
`NO_ACTIVE_ASSIGNMENT`, `MILEAGE_TOO_LOW`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`,
`TOO_MANY_REQUESTS`...). Les erreurs de validation ajoutent `details` (messages par champ).

### Règles métier principales

- **Documents** : statut calculé (`VALIDE`, `EXPIRANT_BIENTOT` sous `ALERT_THRESHOLD_DAYS` jours,
  `EXPIRE`) ; seul le document le plus récent de chaque type compte pour les alertes.
- **Maintenance** : échéance fixée par le dernier entretien de chaque type ; dépassée si le compteur
  atteint `prochainEntretienKm` ou si `prochainEntretienDate` est passée, « à prévoir » sous
  `MAINTENANCE_KM_MARGIN` km ou `ALERT_THRESHOLD_DAYS` jours.
- **Affectations** : une seule en cours par véhicule et par chauffeur ; véhicule hors service,
  chauffeur inactif ou permis expiré refusés ; pas de date future ni de chevauchement.
- **Kilométrage** : jamais inférieur au compteur, ni daté dans le futur ou avant le dernier relevé ;
  le chauffeur ne saisit que pour son véhicule affecté.
- **Incidents** : le chauffeur signale sur son véhicule affecté et ne voit que ses incidents.

## Tests

- **Unitaires** (`pnpm test`) : règles métier pures (expiration, échéances d'entretien,
  affectations, kilométrage, alertes), guards, authentification, stockage, format d'erreur.
- **End-to-end** (`pnpm --filter @teranga-fleet/api test:e2e`) : l'API complète contre une base
  dédiée `<base>_test`, créée et migrée automatiquement (`migrate deploy`, non destructif). Les
  tests ne dépendent d'aucune donnée existante : chacun crée ses propres entreprises. Une matrice
  de sécurité vérifie, pour chaque route, l'isolation entre entreprises (404) et les droits du
  chauffeur (403).
