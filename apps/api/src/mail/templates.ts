import type { DigestItem } from '../alerts/digest-rules';
import type { MailMessage } from './mail.service';

type Content = Omit<MailMessage, 'to'>;

const BRAND = '#0E3D37';

/** Tout texte venant des données (noms, plaques...) passe par ici avant d'entrer dans le HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Bouton compatible avec les clients email (tableau et styles en ligne). */
export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
<tr><td style="border-radius:8px;background:${BRAND}">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;color:#ffffff;font-weight:600;text-decoration:none">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** Gabarit commun : `body` est du HTML déjà échappé. */
export function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px">
<tr><td style="padding:20px 28px;background:${BRAND};border-radius:12px 12px 0 0;color:#ffffff;font-size:18px;font-weight:700">Teranga Fleet</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.55">${body}</td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#64748b">Email automatique envoyé par Teranga Fleet. Merci de ne pas y répondre.</p>
</td></tr></table>
</body></html>`;
}

export function passwordResetEmail(input: { nom: string; link: string; minutes: number }): Content {
  const subject = 'Réinitialisation de votre mot de passe';
  const text = [
    `Bonjour ${input.nom},`,
    '',
    'Une réinitialisation du mot de passe de votre compte Teranga Fleet a été demandée.',
    `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable ${input.minutes} minutes, une seule fois) :`,
    input.link,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.",
  ].join('\n');
  const html = layout(
    subject,
    `<p>Bonjour ${escapeHtml(input.nom)},</p>
<p>Une réinitialisation du mot de passe de votre compte Teranga Fleet a été demandée.</p>
${button('Choisir un nouveau mot de passe', input.link)}
<p style="font-size:13px;color:#475569">Ce lien est valable ${input.minutes} minutes et ne peut servir qu'une fois.
Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.</p>`,
  );
  return { subject, text, html };
}

/** Au-delà, l'email renvoie vers la page Alertes plutôt que de tout lister. */
export const DIGEST_MAX_ITEMS = 40;

const plural = (n: number, singular: string, pluralForm: string) =>
  `${n} ${n > 1 ? pluralForm : singular}`;

/** « 2 alertes critiques et 1 à surveiller » */
export function digestSummary(items: DigestItem[]): string {
  const critical = items.filter((i) => i.severity === 'CRITICAL').length;
  const warning = items.length - critical;
  const parts = [
    critical && plural(critical, 'alerte critique', 'alertes critiques'),
    warning && `${critical ? warning : plural(warning, 'alerte', 'alertes')} à surveiller`,
  ].filter(Boolean);
  return parts.join(' et ');
}

export function alertDigestEmail(input: {
  companyName: string;
  recipientName: string;
  items: DigestItem[];
  alertsUrl: string;
  accountUrl: string;
}): Content {
  const { items } = input;
  const summary = digestSummary(items);
  const fresh = items.filter((i) => i.isNew).length;
  const shown = items.slice(0, DIGEST_MAX_ITEMS);
  const hidden = items.length - shown.length;
  const subject = `${input.companyName} : ${summary}`;

  const groups = [
    { label: 'Critiques', color: '#b91c1c', items: shown.filter((i) => i.severity === 'CRITICAL') },
    {
      label: 'À surveiller',
      color: '#b45309',
      items: shown.filter((i) => i.severity === 'WARNING'),
    },
  ].filter((g) => g.items.length > 0);

  const text = [
    `Bonjour ${input.recipientName},`,
    '',
    `Flotte ${input.companyName} : ${summary}${fresh ? ` (dont ${fresh} nouvelle${fresh > 1 ? 's' : ''} depuis le dernier récapitulatif)` : ''}.`,
    ...groups.flatMap((g) => [
      '',
      `${g.label.toUpperCase()}`,
      ...g.items.map((i) => `- ${i.isNew ? '[Nouveau] ' : ''}${i.title} : ${i.message}`),
    ]),
    ...(hidden > 0 ? ['', `Et ${hidden} autre${hidden > 1 ? 's' : ''}.`] : []),
    '',
    `Toutes les alertes : ${input.alertsUrl}`,
    `Ne plus recevoir ce récapitulatif : ${input.accountUrl}`,
  ].join('\n');

  const rows = (group: (typeof groups)[number]) =>
    group.items
      .map(
        (i) => `<tr><td style="padding:8px 0;border-top:1px solid #e2e8f0">
<strong>${escapeHtml(i.title)}</strong>${
          i.isNew
            ? ' <span style="display:inline-block;padding:1px 6px;border-radius:9px;background:#dbeafe;color:#1e40af;font-size:11px;font-weight:600">Nouveau</span>'
            : ''
        }<br><span style="color:#475569;font-size:14px">${escapeHtml(i.message)}</span></td></tr>`,
      )
      .join('');

  const html = layout(
    subject,
    `<p>Bonjour ${escapeHtml(input.recipientName)},</p>
<p>Flotte <strong>${escapeHtml(input.companyName)}</strong> : ${escapeHtml(summary)}${
      fresh
        ? `, dont <strong>${fresh} nouvelle${fresh > 1 ? 's' : ''}</strong> depuis le dernier récapitulatif`
        : ''
    }.</p>
${groups
  .map(
    (
      g,
    ) => `<h2 style="margin:24px 0 4px;font-size:15px;color:${g.color}">${g.label} (${g.items.length})</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows(g)}</table>`,
  )
  .join('\n')}
${hidden > 0 ? `<p style="color:#475569">Et ${hidden} autre${hidden > 1 ? 's' : ''}.</p>` : ''}
${button('Voir toutes les alertes', input.alertsUrl)}
<p style="font-size:13px;color:#475569">Vous recevez ce récapitulatif chaque matin en tant que gestionnaire.
<a href="${escapeHtml(input.accountUrl)}" style="color:#475569">Ne plus le recevoir</a>.</p>`,
  );
  return { subject, text, html };
}
