import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '../../generated/prisma/client';
import { ApiExceptionFilter } from './api-exception.filter';
import { conflict } from './app.exception';
import { validationExceptionFactory } from './validation';

function run(exception: unknown) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  new ApiExceptionFilter().catch(exception, host);
  return {
    status: res.status.mock.calls[0][0] as number,
    body: res.json.mock.calls[0][0] as unknown,
  };
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('détail technique', { code, clientVersion: '7' });

describe('ApiExceptionFilter', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

  it('conserve le code et le message des exceptions métier', () => {
    expect(run(conflict('Véhicule déjà affecté', 'VEHICLE_UNAVAILABLE'))).toEqual({
      status: 409,
      body: { statusCode: 409, error: 'VEHICLE_UNAVAILABLE', message: 'Véhicule déjà affecté' },
    });
  });

  it.each([
    [new UnauthorizedException(), 401, 'UNAUTHORIZED', 'Authentification requise'],
    [new NotFoundException('Cannot GET /x'), 404, 'NOT_FOUND', 'Ressource introuvable'],
    [
      new PayloadTooLargeException('File too large'),
      413,
      'FILE_TOO_LARGE',
      'Fichier trop volumineux',
    ],
    [
      new ThrottlerException(),
      429,
      'TOO_MANY_REQUESTS',
      'Trop de tentatives, réessayez dans une minute',
    ],
    [new BadRequestException('Unexpected field'), 400, 'BAD_REQUEST', 'Requête invalide'],
  ])(
    'traduit les exceptions standard en message français (%#)',
    (exception, status, error, message) => {
      expect(run(exception)).toEqual({ status, body: { statusCode: status, error, message } });
    },
  );

  it.each([
    ['P2002', 409, 'Cette valeur est déjà utilisée'],
    ['P2003', 409, 'Opération impossible : des données liées existent'],
    ['P2025', 404, 'Ressource introuvable'],
  ])('traduit l’erreur Prisma %s sans détail technique', (code, status, message) => {
    const { body } = run(prismaError(code));
    expect(body).toMatchObject({ statusCode: status, message });
    expect(JSON.stringify(body)).not.toContain('détail technique');
  });

  it('renvoie une 500 générique pour une erreur inattendue, sans fuite', () => {
    const { status, body } = run(new Error('connect ECONNREFUSED postgres://user:secret@db'));
    expect(status).toBe(500);
    expect(body).toEqual({
      statusCode: 500,
      error: 'INTERNAL_ERROR',
      message: 'Une erreur inattendue est survenue. Réessayez plus tard.',
    });
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('renvoie aussi une 500 générique pour une erreur Prisma non prévue', () => {
    expect(run(prismaError('P1001')).status).toBe(500);
  });
});

describe('validationExceptionFactory', () => {
  it('produit des messages français champ par champ, y compris imbriqués', () => {
    const exception = validationExceptionFactory([
      { property: 'email', constraints: { isEmail: 'email must be an email' }, children: [] },
      {
        property: 'entreprise',
        children: [
          { property: 'nom', constraints: { isNotEmpty: 'nom should not be empty' }, children: [] },
        ],
      },
      {
        property: 'role',
        constraints: { whitelistValidation: 'property role should not exist' },
        children: [],
      },
      {
        property: 'password',
        constraints: { minLength: 'Le mot de passe doit contenir au moins 8 caractères' },
        children: [],
      },
    ]);
    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: 'Données invalides : email doit être une adresse email valide',
      details: {
        email: ['email doit être une adresse email valide'],
        'entreprise.nom': ['entreprise.nom est obligatoire'],
        role: ["role n'est pas un champ autorisé"],
        password: ['Le mot de passe doit contenir au moins 8 caractères'],
      },
    });
  });
});
