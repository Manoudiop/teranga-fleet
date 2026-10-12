import { Injectable } from '@nestjs/common';
import { PasswordService } from '../auth/password.service';
import { badRequest, conflict, notFound } from '../common/errors/app.exception';
import type { Prisma } from '../generated/prisma/client';
import type { Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

export const accountSelect = {
  id: true,
  nom: true,
  email: true,
  role: true,
  companyId: true,
  disabledAt: true,
  createdAt: true,
  driver: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.UserSelect;

/** Restreint les opérations aux comptes visibles par l'appelant. */
export interface AccountScope {
  companyId?: string;
  roles?: Role[];
}

/**
 * Gestion des comptes utilisateurs, partagée entre l'administrateur de la
 * plateforme (toutes les entreprises) et le gestionnaire (les gestionnaires
 * de son entreprise). Le hash du mot de passe ne sort jamais.
 */
@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  list(scope: AccountScope) {
    return this.prisma.user.findMany({
      where: this.where(scope),
      select: accountSelect,
      orderBy: [{ disabledAt: { sort: 'asc', nulls: 'first' } }, { nom: 'asc' }],
    });
  }

  async create(companyId: string, role: Role, dto: CreateAccountDto) {
    await this.assertEmailAvailable(dto.email);
    return this.prisma.user.create({
      data: {
        nom: dto.nom,
        email: dto.email,
        password: await this.passwords.hash(dto.password),
        role,
        companyId,
      },
      select: accountSelect,
    });
  }

  async update(scope: AccountScope, actorId: string, id: string, dto: UpdateAccountDto) {
    const account = await this.getVisible(scope, id);
    if (dto.disabled && id === actorId) {
      throw badRequest('Vous ne pouvez pas désactiver votre propre compte');
    }
    if (dto.email && dto.email !== account.email) await this.assertEmailAvailable(dto.email);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.nom && { nom: dto.nom }),
        ...(dto.email && { email: dto.email }),
        ...(dto.disabled !== undefined && {
          // Une désactivation déjà en place garde sa date d'origine.
          disabledAt: dto.disabled ? (account.disabledAt ?? new Date()) : null,
        }),
      },
      select: accountSelect,
    });
  }

  async setPassword(scope: AccountScope, id: string, password: string) {
    await this.getVisible(scope, id);
    await this.prisma.user.update({
      where: { id },
      data: { password: await this.passwords.hash(password) },
    });
  }

  private where(scope: AccountScope): Prisma.UserWhereInput {
    return {
      ...(scope.companyId && { companyId: scope.companyId }),
      ...(scope.roles && { role: { in: scope.roles } }),
    };
  }

  /** Compte dans le périmètre de l'appelant, ou 404. */
  private async getVisible(scope: AccountScope, id: string) {
    const account = await this.prisma.user.findFirst({
      where: { id, ...this.where(scope) },
      select: accountSelect,
    });
    if (!account) throw notFound('Compte introuvable');
    return account;
  }

  private async assertEmailAvailable(email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw conflict('Un compte existe déjà avec cet email');
  }
}
