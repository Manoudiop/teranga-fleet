import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizedEmail, StrongPassword, Trim } from '../../common/validators';

export class CreateAccountDto {
  @ApiProperty({ example: 'Awa Ndiaye' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nom: string;

  @ApiProperty({ example: 'awa.ndiaye@teranga-logistique.sn' })
  @NormalizedEmail()
  email: string;

  /** Mot de passe provisoire, à communiquer à la personne. */
  @ApiProperty({ description: '8 caractères minimum, avec au moins une lettre et un chiffre' })
  @StrongPassword()
  password: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @NormalizedEmail()
  email?: string;

  /** true : désactive le compte (connexion refusée, sessions invalidées) ; false : le réactive. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;
}

export class SetPasswordDto {
  @ApiProperty({ description: '8 caractères minimum, avec au moins une lettre et un chiffre' })
  @StrongPassword()
  password: string;
}

export class SetCompanyStatusDto {
  /** true : suspend l'entreprise (plus aucun de ses comptes ne peut se connecter). */
  @ApiProperty()
  @IsBoolean()
  suspended: boolean;
}
