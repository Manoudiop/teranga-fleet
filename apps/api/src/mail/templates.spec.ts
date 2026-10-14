import type { DigestItem } from '../alerts/digest-rules';
import {
  alertDigestEmail,
  DIGEST_MAX_ITEMS,
  digestSummary,
  escapeHtml,
  passwordResetEmail,
} from './templates';

const item = (id: string, severity: 'CRITICAL' | 'WARNING', isNew = false): DigestItem => ({
  id,
  type: 'DOCUMENT_EXPIRED',
  severity,
  title: `Titre ${id}`,
  message: `Message ${id}`,
  vehicleId: null,
  driverId: null,
  documentId: null,
  maintenanceId: null,
  incidentId: null,
  date: null,
  isNew,
});

describe('templates email', () => {
  it('échappe les caractères HTML', () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;',
    );
  });

  it('construit le lien de réinitialisation sans injecter le nom en HTML brut', () => {
    const mail = passwordResetEmail({
      nom: '<b>Awa</b>',
      link: 'https://app.exemple.sn/reset-password?token=abc',
      minutes: 60,
    });
    expect(mail.subject).toBe('Réinitialisation de votre mot de passe');
    expect(mail.text).toContain('https://app.exemple.sn/reset-password?token=abc');
    expect(mail.text).toContain('60 minutes');
    expect(mail.html).toContain('&lt;b&gt;Awa&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>Awa</b>');
    expect(mail.html).toContain('href="https://app.exemple.sn/reset-password?token=abc"');
  });

  it('résume le récapitulatif avec les bons accords', () => {
    expect(digestSummary([item('a', 'WARNING')])).toBe('1 alerte à surveiller');
    expect(digestSummary([item('a', 'CRITICAL')])).toBe('1 alerte critique');
    expect(
      digestSummary([item('a', 'CRITICAL'), item('b', 'CRITICAL'), item('c', 'WARNING')]),
    ).toBe('2 alertes critiques et 1 à surveiller');
  });

  it('limite la longueur du récapitulatif et échappe les messages', () => {
    const items = Array.from({ length: DIGEST_MAX_ITEMS + 3 }, (_, i) => item(`n${i}`, 'WARNING'));
    items[0] = { ...item('x', 'CRITICAL', true), message: '<img src=x onerror=alert(1)>' };
    const mail = alertDigestEmail({
      companyName: 'Flotte <Test>',
      recipientName: 'Awa',
      items,
      alertsUrl: 'https://app.exemple.sn/alerts',
      accountUrl: 'https://app.exemple.sn/account',
    });
    expect(mail.text).toContain('Et 3 autres.');
    expect(mail.text).toContain('[Nouveau] Titre x');
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).toContain('Flotte &lt;Test&gt;');
  });
});
