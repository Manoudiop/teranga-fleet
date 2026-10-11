import { HttpStatus } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { AppException } from './app.exception';

/**
 * Traduction des contraintes class-validator en messages français. Les DTO
 * peuvent toujours fournir un message spécifique, qui est alors conservé.
 */
const MESSAGES: Record<string, string> = {
  isNotEmpty: 'est obligatoire',
  isDefined: 'est obligatoire',
  isString: 'doit être un texte',
  isEmail: 'doit être une adresse email valide',
  isInt: 'doit être un nombre entier',
  isNumber: 'doit être un nombre',
  isPositive: 'doit être positif',
  min: 'est trop petit',
  max: 'est trop grand',
  minLength: 'est trop court',
  maxLength: 'est trop long',
  isEnum: "n'est pas une valeur autorisée",
  isIn: "n'est pas une valeur autorisée",
  isDateString: 'doit être une date valide (AAAA-MM-JJ)',
  isISO8601: 'doit être une date valide (AAAA-MM-JJ)',
  isUUID: "n'est pas un identifiant valide",
  isBoolean: 'doit être vrai ou faux',
  matches: "n'a pas le bon format",
  whitelistValidation: "n'est pas un champ autorisé",
  nestedValidation: 'est invalide',
};

/**
 * Les messages par défaut de class-validator (en anglais) commencent par le nom
 * du champ (« email must be... »), éventuellement précédé de « property » ou
 * « each value in ». Les autres ont été écrits en français dans les DTO.
 */
function isDefaultMessage(message: string, property: string): boolean {
  return !message || new RegExp(`^(property |each value in )?${property}\\b`).test(message);
}

function collect(errors: ValidationError[], prefix: string, out: Record<string, string[]>) {
  for (const error of errors) {
    const field = prefix ? `${prefix}.${error.property}` : error.property;
    if (error.constraints) {
      out[field] = Object.entries(error.constraints).map(([constraint, original]) =>
        isDefaultMessage(original, error.property)
          ? `${field} ${MESSAGES[constraint] ?? 'est invalide'}`
          : original,
      );
    }
    if (error.children?.length) collect(error.children, field, out);
  }
}

export function validationExceptionFactory(errors: ValidationError[]): AppException {
  const details: Record<string, string[]> = {};
  collect(errors, '', details);

  const first = Object.values(details)[0]?.[0];
  const exception = new AppException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_ERROR',
    first ? `Données invalides : ${first}` : 'Données invalides',
  );
  (exception.getResponse() as Record<string, unknown>).details = details;
  return exception;
}
