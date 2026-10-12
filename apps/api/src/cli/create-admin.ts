/**
 * Crée un administrateur de la plateforme (rôle ADMIN). Seul moyen d'obtenir
 * le premier compte ADMIN en production (le seed est réservé au développement).
 *
 *   ADMIN_PASSWORD='…' node dist/cli/create-admin.js --email admin@exemple.sn --nom "Prénom Nom"
 *   (en développement : ADMIN_PASSWORD='…' pnpm --filter @teranga-fleet/api admin:create -- --email …)
 *
 * Le mot de passe est lu dans ADMIN_PASSWORD et non en argument, pour ne pas
 * rester dans l'historique du shell.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { parseArgs } from 'node:util';
import { PrismaClient } from '../generated/prisma/client';
import { prismaClientOptions } from '../prisma/prisma.options';

function fail(message: string): never {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, nom: { type: 'string' } },
  });
  const email = values.email?.trim().toLowerCase();
  const nom = values.nom?.trim() || 'Administrateur';
  const password = process.env.ADMIN_PASSWORD ?? '';

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) fail('indiquez --email avec une adresse valide');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    fail('ADMIN_PASSWORD doit contenir au moins 8 caractères, une lettre et un chiffre');
  }
  if (!process.env.DATABASE_URL) fail('DATABASE_URL manquante');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    ...prismaClientOptions,
  });
  try {
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      fail(`un compte existe déjà avec l'email ${email}`);
    }
    await prisma.user.create({
      data: {
        nom,
        email,
        role: 'ADMIN',
        password: await argon2.hash(password, { type: argon2.argon2id }),
      },
    });
    console.log(`Administrateur ${email} créé.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
