import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Pas de `env('DATABASE_URL')`, qui échoue si la variable est absente :
    // `prisma generate` (lancé au postinstall) doit fonctionner sans .env.
    // Les commandes qui touchent la base échouent toujours sans URL valide.
    url: process.env.DATABASE_URL ?? '',
  },
});
