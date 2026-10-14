import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { Prisma } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { alertDigestEmail } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from './alerts.service';
import { digestItems, nextRunAt, utcDay } from './digest-rules';

/** Destinataires : gestionnaires actifs qui n'ont pas désactivé le récapitulatif. */
const recipientWhere = {
  role: 'GESTIONNAIRE',
  disabledAt: null,
  alertDigest: true,
} satisfies Prisma.UserWhereInput;

export interface DigestRunResult {
  /** Entreprises qui ont reçu leur récapitulatif lors de cette exécution. */
  sent: number;
  /** Entreprises sans alerte, déjà servies aujourd'hui ou en échec. */
  skipped: number;
}

/**
 * Récapitulatif quotidien des alertes, envoyé par email aux gestionnaires à
 * ALERT_DIGEST_HOUR (UTC). Une exécution manquée (API arrêtée) est rattrapée
 * au démarrage ; une entreprise ne reçoit jamais deux récapitulatifs le même jour.
 */
@Injectable()
export class AlertDigestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertDigestService.name);
  private readonly hour: number;
  private readonly webUrl: string;
  private readonly enabled: boolean;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.hour = config.get('ALERT_DIGEST_HOUR', { infer: true });
    this.webUrl = config.get('WEB_URL', { infer: true });
    // Les tests déclenchent run() eux-mêmes.
    this.enabled = config.get('NODE_ENV', { infer: true }) !== 'test';
  }

  onModuleInit() {
    if (!this.enabled) return;
    if (new Date().getUTCHours() >= this.hour) {
      // Rattrapage différé : l'API finit de démarrer avant de calculer les alertes.
      setTimeout(() => void this.runSafely(), 30_000).unref();
    }
    this.schedule();
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule() {
    const delay = nextRunAt(new Date(), this.hour).getTime() - Date.now();
    this.timer = setTimeout(() => {
      void this.runSafely();
      this.schedule();
    }, delay);
    this.timer.unref();
  }

  private async runSafely() {
    try {
      const { sent } = await this.run();
      if (sent > 0) this.logger.log(`Récapitulatif des alertes envoyé à ${sent} entreprise(s)`);
    } catch (error) {
      this.logger.error(`Récapitulatif des alertes impossible : ${String(error)}`);
    }
  }

  /** `companyIds` limite l'exécution à certaines entreprises (renvoi ciblé, tests). */
  async run(now = new Date(), companyIds?: string[]): Promise<DigestRunResult> {
    const day = utcDay(now);
    const companies = await this.prisma.company.findMany({
      where: {
        suspendedAt: null,
        users: { some: recipientWhere },
        ...(companyIds && { id: { in: companyIds } }),
      },
      select: {
        id: true,
        nom: true,
        users: { where: recipientWhere, select: { nom: true, email: true } },
      },
    });
    const result: DigestRunResult = { sent: 0, skipped: 0 };
    // Une entreprise à la fois : une erreur sur l'une n'empêche pas les autres.
    for (const company of companies) {
      try {
        if (await this.sendCompany(company, day)) result.sent += 1;
        else result.skipped += 1;
      } catch (error) {
        result.skipped += 1;
        this.logger.error(`Récapitulatif de l'entreprise ${company.id} : ${String(error)}`);
      }
    }
    return result;
  }

  private async sendCompany(
    company: { id: string; nom: string; users: { nom: string; email: string }[] },
    day: Date,
  ): Promise<boolean> {
    const [alerts, previous] = await Promise.all([
      this.alerts.compute(company.id, {}),
      this.prisma.alertDigest.findFirst({
        where: { companyId: company.id, day: { lt: day } },
        orderBy: { day: 'desc' },
        select: { alertIds: true },
      }),
    ]);
    const items = digestItems(alerts, previous ? new Set(previous.alertIds) : null);
    if (items.length === 0) return false;

    // Réservation avant envoi : si une autre instance (ou une exécution précédente)
    // a déjà servi cette entreprise aujourd'hui, la contrainte d'unicité l'indique.
    try {
      await this.prisma.alertDigest.create({
        data: { companyId: company.id, day, alertIds: items.map((i) => i.id) },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }

    const results = await Promise.allSettled(
      company.users.map((user) =>
        this.mail.send({
          to: user.email,
          ...alertDigestEmail({
            companyName: company.nom,
            recipientName: user.nom,
            items,
            alertsUrl: `${this.webUrl}/alerts`,
            accountUrl: `${this.webUrl}/account`,
          }),
        }),
      ),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === results.length) {
      // Aucun email parti : la réservation est levée pour réessayer au prochain passage.
      await this.prisma.alertDigest.delete({
        where: { companyId_day: { companyId: company.id, day } },
      });
      throw failed[0].reason;
    }
    if (failed.length > 0) {
      this.logger.warn(
        `Récapitulatif de l'entreprise ${company.id} : ${failed.length} email(s) sur ${results.length} en échec`,
      );
    }
    return true;
  }
}
