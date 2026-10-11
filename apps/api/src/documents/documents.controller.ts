import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { CompanyId, Roles } from '../auth/decorators';
import { ApiFileUpload } from '../common/api-file.decorator';
import { UuidPipe } from '../common/uuid.pipe';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, DocumentQueryDto, UpdateDocumentDto } from './dto/document.dto';

const FILE_HELP = 'PDF, JPG ou PNG (taille limitée par UPLOAD_MAX_SIZE_MB)';

@ApiTags('Documents')
@ApiBearerAuth()
@Roles('GESTIONNAIRE')
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('vehicles/:vehicleId/documents')
  @ApiFileUpload('fichier', CreateDocumentDto, FILE_HELP)
  @ApiOperation({ summary: 'Ajoute un document à un véhicule, avec un fichier optionnel' })
  create(
    @CompanyId() companyId: string,
    @Param('vehicleId', UuidPipe) vehicleId: string,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() fichier?: Express.Multer.File,
  ) {
    return this.documents.create(companyId, vehicleId, dto, fichier);
  }

  @Get('vehicles/:vehicleId/documents')
  @ApiOperation({ summary: "Documents d'un véhicule avec leur statut calculé" })
  findForVehicle(@CompanyId() companyId: string, @Param('vehicleId', UuidPipe) vehicleId: string) {
    return this.documents.findForVehicle(companyId, vehicleId);
  }

  @Get('documents')
  @ApiOperation({ summary: 'Tous les documents de la flotte, filtrables par type et statut' })
  findAll(@CompanyId() companyId: string, @Query() query: DocumentQueryDto) {
    return this.documents.findAll(companyId, query);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: "Détail d'un document" })
  findOne(@CompanyId() companyId: string, @Param('id', UuidPipe) id: string) {
    return this.documents.findOne(companyId, id);
  }

  @Get('documents/:id/file')
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png')
  @ApiOperation({ summary: 'Télécharge le fichier joint au document' })
  download(@CompanyId() companyId: string, @Param('id', UuidPipe) id: string) {
    return this.documents.download(companyId, id);
  }

  @Patch('documents/:id')
  @ApiFileUpload('fichier', UpdateDocumentDto, `${FILE_HELP}. Remplace le fichier existant.`)
  @ApiOperation({ summary: 'Modifie un document et/ou remplace son fichier' })
  update(
    @CompanyId() companyId: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateDocumentDto,
    @UploadedFile() fichier?: Express.Multer.File,
  ) {
    return this.documents.update(companyId, id, dto, fichier);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un document et son fichier' })
  async remove(@CompanyId() companyId: string, @Param('id', UuidPipe) id: string) {
    await this.documents.remove(companyId, id);
  }
}
