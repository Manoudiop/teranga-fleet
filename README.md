# Teranga Fleet

SaaS multi-tenant de gestion de flotte de véhicules, conçu pour le marché sénégalais et
ouest-africain : entreprises disposant de véhicules de service, transporteurs, loueurs, PME/PMI,
ONG et sociétés de livraison.

> **État d'avancement : MVP complet.** API REST multi-tenant testée (unitaires + e2e sur
> PostgreSQL), dashboard web des gestionnaires, application mobile des chauffeurs avec
> géolocalisation des véhicules.

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

### Premier administrateur (production)

Le compte ADMIN de la plateforme se crée en ligne de commande, sur le serveur de l'API. Le mot de
passe est lu dans `ADMIN_PASSWORD` (pas en argument, pour ne pas rester dans l'historique) :

```bash
ADMIN_PASSWORD='…' node apps/api/dist/cli/create-admin.js --email admin@exemple.sn --nom "Prénom Nom"
# en développement :
ADMIN_PASSWORD='…' pnpm --filter @teranga-fleet/api admin:create -- --email admin@exemple.sn
```

L'administrateur crée ensuite le premier gestionnaire d'une entreprise depuis sa fiche (ou
l'entreprise s'inscrit elle-même via `/register`) ; chaque gestionnaire ajoute ses collègues
depuis la page **Équipe**.

## Variables d'environnement

Seuls les fichiers `.env.example` sont versionnés. Aucun secret ne doit être commité.

### API (`apps/api/.env`)

| Variable                                                                  | Description                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                                                                | `development`, `test` ou `production`                                                            |
| `PORT`                                                                    | Port HTTP de l'API (4000 par défaut)                                                             |
| `CORS_ORIGINS`                                                            | Origines autorisées, séparées par des virgules. Obligatoire en production.                       |
| `DATABASE_URL`                                                            | Chaîne de connexion PostgreSQL (obligatoire)                                                     |
| `SEED_PASSWORD`                                                           | Mot de passe des comptes de démonstration (optionnel)                                            |
| `JWT_SECRET` / `JWT_EXPIRES_IN`                                           | Signature et durée de validité des tokens (phase 3)                                              |
| `STORAGE_DRIVER`                                                          | `local` (développement) ou `s3` (production) (phase 6)                                           |
| `UPLOAD_DIR` / `UPLOAD_MAX_SIZE_MB`                                       | Dossier de stockage local et taille maximale des fichiers                                        |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION` | Stockage S3-compatible                                                                           |
| `ALERT_THRESHOLD_DAYS`                                                    | Seuil des alertes « expire bientôt » et « entretien à prévoir » (30 par défaut)                  |
| `MAINTENANCE_KM_MARGIN`                                                   | Marge en km avant une échéance d'entretien kilométrique (1000 par défaut)                        |
| `AUTH_RATE_LIMIT`                                                         | Tentatives de login / inscription par minute et par IP (10 par défaut)                           |
| `SWAGGER_ENABLED`                                                         | Active la documentation sur /docs (par défaut : hors production uniquement)                      |
| `LOCATION_RETENTION_DAYS`                                                 | Conservation des positions GPS, en jours (90 par défaut)                                         |
| `TRUST_PROXY`                                                             | Proxies de confiance pour lire l'IP réelle du client (`loopback` par défaut)                     |
| `SMTP_URL`                                                                | Serveur d'envoi des emails (`smtps://clé:secret@hôte:465`) ; Mailpit par défaut en développement |
| `MAIL_FROM`                                                               | Expéditeur des emails, ex. `Teranga Fleet <no-reply@teranga-fleet.sn>`                           |
| `WEB_URL`                                                                 | Adresse publique du dashboard, pour les liens des emails (https en production)                   |
| `ALERT_DIGEST_HOUR`                                                       | Heure d'envoi du récapitulatif quotidien des alertes, en UTC = heure de Dakar (7 par défaut)     |

L'API valide sa configuration au démarrage et refuse de démarrer si elle est invalide.

### Web (`apps/web/.env.local`)

| Variable  | Description                                                                         |
| --------- | ----------------------------------------------------------------------------------- |
| `API_URL` | URL de l'API, utilisée uniquement par le serveur Next.js (jamais par le navigateur) |

### Mobile (`apps/mobile/.env`)

| Variable              | Description                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | URL de l'API vue depuis l'appareil (`http://10.0.2.2:4000` pour l'émulateur Android, IP locale du PC pour un téléphone physique) |

Ce fichier ne sert qu'en développement local : il n'est pas versionné, donc pas envoyé aux builds
EAS (voir « Builds natifs »).

## Lancement en développement

```bash
pnpm db:up        # PostgreSQL et Mailpit (emails de développement : http://localhost:8026)
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

## Application mobile chauffeur

Application Expo (SDK 57, Expo Router) réservée au rôle CHAUFFEUR : un gestionnaire qui s'y
connecte est refusé avec un message l'orientant vers le dashboard web.

**Écrans** : `/login`, `/home` (véhicule affecté, service, alertes importantes), `/my-vehicle`,
`/mileage` (validation identique à l'API : jamais inférieur au compteur, pas de date future),
`/incidents` et `/incident-new` (type, gravité, description, photo prise ou choisie dans la
galerie), `/history` (relevés du chauffeur), `/profile` (permis, service, déconnexion) et
`/password` (changement de son mot de passe) et `/forgot-password` (lien de réinitialisation
par email, ouvert ensuite dans le navigateur du téléphone).

**Session** : le JWT est stocké dans le stockage sécurisé du téléphone (Keychain iOS / Keystore
Android, via `expo-secure-store`), restauré au lancement, et la session se ferme à son expiration
ou sur un 401 de l'API ; un compte désactivé ou une entreprise suspendue sont signalés comme tels
à l'écran de connexion. Les écrans sont protégés par `Stack.Protected` (Expo Router).

**Tester sur un téléphone** :

```bash
cp apps/mobile/.env.example apps/mobile/.env   # EXPO_PUBLIC_API_URL = IP locale du PC, ex. http://192.168.1.20:4000
pnpm dev:mobile                                # scanner le QR code avec Expo Go
```

Le téléphone et le PC doivent être sur le même réseau. Expo Go suffit pour tout tester, sauf la
localisation en arrière-plan (voir ci-dessous), qui demande un build natif.

### Builds natifs (EAS)

`apps/mobile/eas.json` définit trois profils :

| Profil        | Usage                                                                       | Distribution           |
| ------------- | --------------------------------------------------------------------------- | ---------------------- |
| `development` | Build de développement (`expo-dev-client`) : tester la localisation de fond | interne                |
| `preview`     | Version de test complète, APK Android installable directement               | interne                |
| `production`  | Publication sur les stores (numéro de build incrémenté automatiquement)     | Play Store / App Store |

Chaque profil lit ses variables dans l'environnement EAS du même nom. `EXPO_PUBLIC_API_URL` est
obligatoire : une application compilée sans elle affiche « Application mal configurée » au lieu
d'appeler `localhost`. Hors développement, l'API doit être servie en **HTTPS** (iOS et Android
bloquent le HTTP en clair dans les builds de release).

```bash
cd apps/mobile
npx eas-cli login                                    # compte Expo (gratuit)
npx eas-cli init                                     # relie le projet (ajoute projectId à app.json)
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://api.exemple.sn --visibility plaintext
npx eas-cli build --profile development --platform android
npx eas-cli build --profile preview --platform android
```

Identifiants applicatifs : `sn.terangafleet.chauffeur` (Android et iOS), à adapter avant publication.

## Géolocalisation des véhicules

Les véhicules sont localisés grâce au téléphone de leur chauffeur, **uniquement pendant son
service**.

1. Le chauffeur appuie sur « Passer en service ». La première fois, un écran explique ce qui est
   collecté, quand, qui y a accès et pour combien de temps ; il doit l'accepter explicitement.
2. Le téléphone demande l'autorisation de localisation. Avec « Toujours autoriser » (build natif),
   une tâche système (`expo-location` + `expo-task-manager`) relève la position environ chaque
   minute ou tous les 100 m, même écran éteint ; Android affiche une notification permanente
   pendant le service. Dans Expo Go, ou sans cette autorisation, le suivi fonctionne tant que
   l'application est ouverte.
3. Les points sont mis en file sur le téléphone puis envoyés par lots (`POST /locations`) : rien
   n'est perdu dans une zone sans réseau. Les points renvoyés deux fois sont ignorés.
4. Le suivi s'arrête quand le chauffeur termine son service, se déconnecte, retire son accord
   depuis son profil, ou quand son affectation est terminée.

Côté gestionnaire : page **Carte** (dernière position de chaque véhicule, rafraîchie chaque
minute, couleur selon la fraîcheur) et section **Localisation** de la fiche véhicule (tracé sur
24 h, 3 jours ou 7 jours). Fonds de carte OpenStreetMap via Leaflet.

**Données personnelles.** La position d'un chauffeur est une donnée personnelle (loi sénégalaise
n° 2008-12, contrôlée par la CDP). Garde-fous en place : collecte limitée au service et après
consentement, accès réservé aux gestionnaires de l'entreprise, suppression automatique après
`LOCATION_RETENTION_DAYS` jours (90 par défaut). Avant la mise en production, l'entreprise
cliente doit informer ses chauffeurs et effectuer les formalités auprès de la CDP.

**En production**, les tuiles `tile.openstreetmap.org` ne sont pas prévues pour un usage
commercial intensif : utiliser un fournisseur de tuiles (MapTiler, Stadia, etc.) ou un serveur
de tuiles hébergé.

## Récapitulatif quotidien des alertes

Chaque jour à `ALERT_DIGEST_HOUR` heures (UTC, soit l'heure de Dakar ; 7 h par défaut), chaque
gestionnaire actif reçoit par email les alertes **critiques** et **à surveiller** de sa flotte,
regroupées par gravité. Les alertes apparues depuis le récapitulatif précédent sont marquées
« Nouveau ». Aucun email n'est envoyé les jours sans alerte, ni aux entreprises suspendues, ni aux
chauffeurs.

- **Désabonnement** : case « Récapitulatif quotidien des alertes » dans **Mon compte**, lien en bas
  de chaque email.
- **Un seul envoi par jour et par entreprise**, même avec plusieurs instances de l'API ou après un
  redémarrage : l'envoi est réservé en base (table `alert_digests`, unique par entreprise et par
  jour). Un envoi manqué pendant un arrêt de l'API est rattrapé à son démarrage.
- **Envoi manuel** (renvoi à un client, test) ; les entreprises déjà servies le jour même sont
  ignorées :

```bash
node apps/api/dist/cli/send-alert-digest.js [--company <id>]
# en développement :
pnpm --filter @teranga-fleet/api alerts:digest -- --company <id>
```

## Dashboard web

Application Next.js 16 (App Router) destinée aux gestionnaires, sur http://localhost:3001.

**Sécurité de la session.** Le navigateur ne voit jamais le JWT :

- `/api/auth/login` et `/api/auth/register` (route handlers Next.js) appellent l'API et placent
  le token dans un cookie `httpOnly`, `SameSite=Lax` (`Secure` en production) ;
- le navigateur appelle `/api/<chemin>`, relayé vers l'API avec le token (« backend for
  frontend ») ; les écritures venant d'un autre site sont refusées (CSRF) ;
- `src/proxy.ts` redirige vers `/login` toute page visitée sans session ; un 401 de l'API efface le
  cookie et renvoie à la connexion.

**Pages** : `/login`, `/register`, `/forgot-password`, `/reset-password`, `/dashboard`, `/map`, `/vehicles` (+ `/new`, `/[id]`, `/[id]/edit`),
`/drivers` (+ `/new`, `/[id]`), `/assignments`, `/documents`, `/maintenance`, `/incidents`,
`/alerts`, `/team` (gestionnaires de l'entreprise : ajout, désactivation, nouveau mot de passe),
`/account` (profil et changement de mot de passe), et pour le rôle ADMIN `/admin` (entreprises)
et `/admin/companies/[id]` (suspension, comptes, création d'un gestionnaire). Un chauffeur qui se
connecte au web est invité à utiliser l'application mobile.

**Choix techniques** : TanStack Query (cache et invalidation après chaque écriture), React Hook
Form + Zod (validation côté client, erreurs de l'API reportées sous les champs), Tailwind CSS 4,
icônes `lucide-react`. Les filtres des listes sont conservés dans l'URL (liens partageables,
bouton Retour). Les fichiers (documents, photos) passent par le relais authentifié. Le choix
d'un véhicule ou d'un chauffeur se fait par une liste avec recherche côté serveur (20 résultats
à la fois) : elle reste utilisable quelle que soit la taille de la flotte.

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

| Rôle         | Accès                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| GESTIONNAIRE | Toute la flotte de son entreprise et les comptes gestionnaires de son équipe |
| CHAUFFEUR    | Son profil, son véhicule affecté, ses relevés et ses incidents, ses alertes  |
| ADMIN        | Entreprises et comptes (`/admin/*`) ; aucun accès aux données de flotte      |

Une ressource d'une autre entreprise renvoie toujours **404**, comme une ressource inexistante.

**Comptes désactivés et entreprises suspendues.** Un gestionnaire peut désactiver un collègue, et
l'administrateur n'importe quel compte ou une entreprise entière. Rien n'est supprimé : la
connexion est refusée (403 `ACCOUNT_DISABLED` / `COMPANY_SUSPENDED`) et le contrôle est refait à
chaque requête, si bien que les sessions en cours sont coupées immédiatement (401 avec le même
code). Personne ne peut désactiver son propre compte. Chacun change son mot de passe avec
`PUT /auth/password` (mot de passe actuel exigé).

**Mot de passe oublié.** `POST /auth/forgot-password` répond toujours 204, avant tout traitement :
ni la réponse ni sa durée ne révèlent si un compte existe. Si le compte existe et peut se
connecter, un email contient un lien `WEB_URL/reset-password?token=…`, valable une heure et à usage
unique ; un seul email part toutes les deux minutes pour un même compte. Seule l'empreinte SHA-256
du jeton est stockée. Une réinitialisation par lien, par un gestionnaire ou par l'administrateur
ferme toutes les sessions ouvertes du compte ; un changement fait par la personne elle-même
(mot de passe actuel saisi) conserve sa session.

### Endpoints principaux

| Domaine      | Endpoints                                                                                                                            | Rôles                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| Auth         | `POST /auth/register-company`, `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`                         | public                  |
|              | `GET /auth/me`, `PUT /auth/password`                                                                                                 | tous                    |
|              | `PATCH /auth/preferences` (récapitulatif quotidien des alertes)                                                                      | gestionnaire            |
| Équipe       | `GET/POST /users`, `PATCH /users/:id` (désactivation), `PUT /users/:id/password`                                                     | gestionnaire            |
| Véhicules    | `POST/GET /vehicles`, `GET/PATCH/DELETE /vehicles/:id` — filtres `search`, `status`, `alerts`, `available`, pagination               | gestionnaire            |
| Chauffeurs   | `POST/GET /drivers`, `GET/PATCH/DELETE /drivers/:id`, `PUT /drivers/:id/account` — filtres `search`, `statut`, `permis`, `available` | gestionnaire            |
|              | `GET /drivers/me`, `GET /drivers/me/mileage`                                                                                         | chauffeur               |
| Documents    | `POST/GET /vehicles/:vehicleId/documents`, `GET /documents`, `GET/PATCH/DELETE /documents/:id`, `GET /documents/:id/file`            | gestionnaire            |
| Maintenance  | `POST/GET /maintenance`, `GET /maintenance/due`, `GET/PATCH/DELETE /maintenance/:id`                                                 | gestionnaire            |
| Affectations | `POST/GET /assignments`, `GET/PATCH /assignments/:id`, `POST /assignments/:id/end`                                                   | gestionnaire            |
| Kilométrage  | `POST /mileage`                                                                                                                      | chauffeur, gestionnaire |
|              | `GET /vehicles/:vehicleId/mileage`                                                                                                   | gestionnaire            |
| Localisation | `POST /locations` (lot de positions du véhicule affecté)                                                                             | chauffeur               |
|              | `GET /locations/latest`, `GET /vehicles/:vehicleId/locations?from=&to=`                                                              | gestionnaire            |
| Incidents    | `POST/GET /incidents`, `GET /incidents/:id`, `POST/GET /incidents/:id/photo`                                                         | chauffeur, gestionnaire |
|              | `PATCH /incidents/:id` (statut, gravité, notes, clôture)                                                                             | gestionnaire            |
| Alertes      | `GET /alerts` — filtres `vehicleId`, `severity`, `type`                                                                              | gestionnaire, chauffeur |
| Dashboard    | `GET /dashboard/summary`, `GET /dashboard/maintenance-costs?months=6`                                                                | gestionnaire            |
| Admin        | `GET /admin/stats`, `GET /admin/companies`, `GET /admin/companies/:id`, `PATCH /admin/companies/:id/status`                          | admin                   |
|              | `POST /admin/companies/:id/managers`, `PATCH /admin/users/:id`, `PUT /admin/users/:id/password`                                      | admin                   |

`available=true` (véhicules et chauffeurs) ne garde que ce qui peut être affecté : véhicule pas
hors service, chauffeur actif, et aucune affectation en cours.

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
`INVALID_CREDENTIALS`, `INVALID_RESET_TOKEN`, `ACCOUNT_DISABLED`, `COMPANY_SUSPENDED`, `NOT_FOUND`, `CONFLICT`, `VEHICLE_UNAVAILABLE`, `DRIVER_UNAVAILABLE`,
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
