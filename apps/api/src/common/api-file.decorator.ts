import { applyDecorators, Type, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, getSchemaPath, ApiExtraModels } from '@nestjs/swagger';

/**
 * Route multipart/form-data avec un fichier optionnel `field` et les champs du DTO.
 * Taille et nombre de fichiers limités par la configuration de Multer (StorageModule).
 */
export function ApiFileUpload(field: string, dto: Type<unknown>, description: string) {
  return applyDecorators(
    UseInterceptors(FileInterceptor(field)),
    ApiConsumes('multipart/form-data'),
    ApiExtraModels(dto),
    ApiBody({
      schema: {
        allOf: [
          { $ref: getSchemaPath(dto) },
          {
            type: 'object',
            properties: { [field]: { type: 'string', format: 'binary', description } },
          },
        ],
      },
    }),
  );
}
