import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { AppException } from '../common/errors/app.exception';
import type { Env } from '../config/env.validation';
import { MailService } from '../mail/mail.service';
import { passwordResetEmail } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import { accountBlock } from './account-status';
import { PasswordService } from './password.service';

/** Durée de validité d'un lien de réinitialisation. */
export const RESET_TTL_MINUTES = 60;
/** Délai minimal entre deux emails pour un même compte (anti-harcèlement). */
export const RESET_RESEND_DELAY_MS = 2 * 60_000;

export const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Envoie un lien de réinitialisation si le compte existe et peut se connecter.
   * Ne renvoie jamais d'information à l'appelant : le contrôleur répond avant
   * même que ce traitement commence.
   */
  async request(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        nom: true,
        email: true,
        disabledAt: true,
        company: { select: { suspendedAt: true } },
      },
    });
    if (!user || accountBlock(user, user.company)) return;

    const now = new Date();
    const recent = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        createdAt: { gt: new Date(now.getTime() - RESET_RESEND_DELAY_MS) },
      },
      select: { id: true },
    });
    if (recent) return;

    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      // Un seul lien valide à la fois par compte ; les liens expirés de tous sont purgés.
      this.prisma.passwordResetToken.deleteMany({
        where: { OR: [{ userId: user.id }, { expiresAt: { lt: now } }] },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(token),
          expiresAt: new Date(now.getTime() + RESET_TTL_MINUTES * 60_000),
        },
      }),
    ]);

    const link = `${this.config.get('WEB_URL', { infer: true })}/reset-password?token=${token}`;
    await this.mail.send({
      to: user.email,
      ...passwordResetEmail({ nom: user.nom, link, minutes: RESET_TTL_MINUTES }),
    });
  }

  /** Lance `request` sans le faire attendre à la requête HTTP ; les échecs sont journalisés. */
  requestInBackground(email: string): void {
    this.request(email).catch((error: unknown) =>
      this.logger.error(
        `Échec de l'envoi du lien de réinitialisation : ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  /** Remplace le mot de passe et révoque les sessions ouvertes avant. */
  async reset(token: string, password: string): Promise<void> {
    const passwordHash = await this.passwords.hash(password);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.passwordResetToken.findUnique({
        where: { tokenHash: hashResetToken(token) },
        select: { id: true, userId: true, expiresAt: true, usedAt: true },
      });
      if (!record || record.usedAt || record.expiresAt <= now) throw invalidToken();
      // Condition sur usedAt : deux utilisations simultanées du lien ne passent pas toutes les deux.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: now },
      });
      if (claimed.count === 0) throw invalidToken();
      await tx.user.update({
        where: { id: record.userId },
        data: { password: passwordHash, passwordChangedAt: now },
      });
      await tx.passwordResetToken.deleteMany({
        where: { userId: record.userId, id: { not: record.id } },
      });
    });
  }
}

const invalidToken = () =>
  new AppException(
    HttpStatus.BAD_REQUEST,
    'INVALID_RESET_TOKEN',
    'Ce lien de réinitialisation est invalide ou a expiré. Faites une nouvelle demande.',
  );
