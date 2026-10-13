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
