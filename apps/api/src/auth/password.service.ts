import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService implements OnModuleInit {
  /** Hash factice vérifié quand l'email est inconnu, pour ne pas révéler par le temps de réponse si un compte existe. */
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash('mot-de-passe-factice-pour-egaliser-le-temps');
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string | null | undefined, password: string): Promise<boolean> {
    try {
      const ok = await argon2.verify(hash || this.dummyHash, password);
      return Boolean(hash) && ok;
    } catch {
      return false;
    }
  }
}
