import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.validation';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

// argon2 est lent par conception : sous la charge des suites en parallèle, 5 s ne suffisent pas toujours.
jest.setTimeout(20_000);

describe('AuthService', () => {
  const passwords = new PasswordService();
  let hash: string;

  const prisma = {
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn(),
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
  const config = { get: jest.fn().mockReturnValue('7d') };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    passwords,
    jwt as unknown as JwtService,
    config as unknown as ConfigService<Env, true>,
  );

  beforeAll(async () => {
    await passwords.onModuleInit();
    hash = await passwords.hash('MotDePasse123');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'u1',
      email: 'a@b.sn',
      role: 'GESTIONNAIRE',
    });
  });

  it('connecte un utilisateur avec le bon mot de passe et signe un JWT ne contenant que son id', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', password: hash });

    const res = await service.login({ email: 'a@b.sn', password: 'MotDePasse123' });

    expect(res.accessToken).toBe('signed.jwt.token');
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1' });
    expect(res.user).not.toHaveProperty('password');
  });

  it('demande explicitement le hash, exclu par défaut', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', password: hash });
    await service.login({ email: 'a@b.sn', password: 'MotDePasse123' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ omit: { password: false } }),
    );
  });

  it.each([
    ['un mauvais mot de passe', { id: 'u1', password: '' }, 'Mauvais123'],
    ['un email inconnu', null, 'MotDePasse123'],
  ])('refuse %s avec le même message', async (_label, user, password) => {
    prisma.user.findUnique.mockResolvedValue(user && { ...user, password: user.password || hash });

    const error = await service.login({ email: 'a@b.sn', password }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
    expect((error as HttpException).getResponse()).toMatchObject({
      error: 'INVALID_CREDENTIALS',
      message: 'Email ou mot de passe incorrect',
    });
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it("refuse l'inscription avec un email déjà utilisé, sans ouvrir de transaction", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existant' });

    await expect(
      service.registerCompany({
        entreprise: { nom: 'X', email: 'x@x.sn' },
        gestionnaire: { nom: 'Y', email: 'a@b.sn', password: 'MotDePasse123' },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
