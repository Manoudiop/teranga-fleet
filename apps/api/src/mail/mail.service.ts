export interface MailMessage {
  to: string;
  subject: string;
  /** Version texte, lue par les clients qui n'affichent pas le HTML. */
  text: string;
  html: string;
}

/**
 * Envoi d'emails. Implémentations : SMTP (tout fournisseur : Brevo, Resend,
 * Mailjet... ; Mailpit en développement) et mémoire (tests).
 */
export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}
