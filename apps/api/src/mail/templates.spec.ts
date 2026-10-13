import { escapeHtml, passwordResetEmail } from './templates';

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
});
