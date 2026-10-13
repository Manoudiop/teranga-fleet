import { createTransport, type Transporter } from 'nodemailer';
import { MailService, type MailMessage } from './mail.service';

export class SmtpMailService extends MailService {
  private readonly transport: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    super();
    // Délais courts : un fournisseur injoignable ne doit pas bloquer l'API.
    this.transport = createTransport(smtpUrl, {
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}
