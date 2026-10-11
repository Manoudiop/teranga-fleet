import { applyDecorators } from '@nestjs/common';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Supprime les espaces superflus d'un texte (undefined/null inchangés). */
export const Trim = () =>
  Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  );

/** Email normalisé (minuscules, sans espaces) et validé. */
export const NormalizedEmail = () =>
  applyDecorators(
    Transform(({ value }: TransformFnParams): unknown =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    IsEmail({}, { message: 'Adresse email invalide' }),
    MaxLength(254),
  );

/** Politique de mot de passe : 8 à 128 caractères, au moins une lettre et un chiffre. */
export const StrongPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' }),
    MaxLength(128, { message: 'Le mot de passe ne peut pas dépasser 128 caractères' }),
    Matches(/[A-Za-z]/, { message: 'Le mot de passe doit contenir au moins une lettre' }),
    Matches(/\d/, { message: 'Le mot de passe doit contenir au moins un chiffre' }),
  );
