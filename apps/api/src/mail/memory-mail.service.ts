import { MailService, type MailMessage } from './mail.service';

/** Garde les emails en mémoire : les tests e2e lisent ce qui aurait été envoyé. */
export class MemoryMailService extends MailService {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  /** Derniers emails reçus par une adresse, le plus récent en dernier. */
  to(address: string): MailMessage[] {
    return this.sent.filter((m) => m.to === address);
  }
}
