/**
 * Envoie le récapitulatif des alertes du jour sans attendre l'heure planifiée
 * (ALERT_DIGEST_HOUR). Les entreprises déjà servies aujourd'hui sont ignorées.
 *
 *   node dist/cli/send-alert-digest.js [--company <id>]...
 *   (en développement : pnpm --filter @teranga-fleet/api alerts:digest -- --company <id>)
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseArgs } from 'node:util';
import { AlertDigestService } from '../alerts/alert-digest.service';
import { AppModule } from '../app.module';

async function main() {
  const { values } = parseArgs({
    options: { company: { type: 'string', multiple: true } },
  });
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const result = await app.get(AlertDigestService).run(new Date(), values.company);
    console.log(
      `Récapitulatif envoyé à ${result.sent} entreprise(s) ; ${result.skipped} ignorée(s) (aucune alerte, déjà servie aujourd'hui ou en échec).`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  new Logger('send-alert-digest').error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
