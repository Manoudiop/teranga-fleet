import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { NormalizedEmail, StrongPassword, Trim } from '../../common/validators';

export class LoginDto {
  @ApiProperty({ example: 'gestionnaire@teranga-logistique.example' })
  @NormalizedEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  @MaxLength(128)
  password: string;
}

export class RegisterCompanyInfoDto {
  @ApiProperty({ example: 'Teranga Logistique SARL' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nom: string;

  @ApiProperty({ example: 'contact@teranga-logistique.sn' })
  @NormalizedEmail()
  email: string;

  @ApiPropertyOptional({ example: '+221 33 820 45 10' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(30)
  telephone?: string;

  @ApiPropertyOptional({ example: 'Route de Rufisque, Dakar' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  adresse?: string;
}

export class RegisterManagerDto {
  @ApiProperty({ example: 'Ibrahima Fall' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nom: string;

  @ApiProperty({ example: 'ibrahima.fall@teranga-logistique.sn' })
  @NormalizedEmail()
  email: string;

  @ApiProperty({ description: '8 caractères minimum, avec au moins une lettre et un chiffre' })
  @StrongPassword()
  password: string;
}

export class RegisterCompanyDto {
  @ApiProperty({ type: RegisterCompanyInfoDto })
  @ValidateNested()
  @Type(() => RegisterCompanyInfoDto)
  entreprise: RegisterCompanyInfoDto;

  @ApiProperty({ type: RegisterManagerDto })
  @ValidateNested()
  @Type(() => RegisterManagerDto)
  gestionnaire: RegisterManagerDto;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe actuel est obligatoire' })
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ description: '8 caractères minimum, avec au moins une lettre et un chiffre' })
  @StrongPassword()
  newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'gestionnaire@teranga-logistique.example' })
  @NormalizedEmail()
  email: string;
}

export class ResetPasswordDto {
  /** Jeton reçu dans le lien envoyé par email. */
  @ApiProperty()
  @IsString()
  @Length(20, 100, { message: 'Lien de réinitialisation invalide' })
  token: string;

  @ApiProperty({ description: '8 caractères minimum, avec au moins une lettre et un chiffre' })
  @StrongPassword()
  password: string;
}

export class PreferencesDto {
  /** Récapitulatif quotidien des alertes par email (gestionnaires). */
  @ApiProperty()
  @IsBoolean()
  alertDigest: boolean;
}
