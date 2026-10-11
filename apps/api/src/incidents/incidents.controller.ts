import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CompanyId, CurrentUser, Roles } from '../auth/decorators';
import { ApiFileUpload } from '../common/api-file.decorator';
import { UuidPipe } from '../common/uuid.pipe';
import {
  CreateIncidentDto,
  IncidentPhotoDto,
  IncidentQueryDto,
  UpdateIncidentDto,
} from './dto/incident.dto';
import { IncidentsService } from './incidents.service';

const PHOTO_HELP = 'Photo JPG ou PNG (taille limitée par UPLOAD_MAX_SIZE_MB)';

@ApiTags('Incidents')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Post()
  @Roles('CHAUFFEUR', 'GESTIONNAIRE')
  @ApiFileUpload('photo', CreateIncidentDto, PHOTO_HELP)
  @ApiOperation({
    summary: 'Signale un incident, avec une photo optionnelle',
    description:
      'Un chauffeur ne peut signaler un incident que sur le véhicule qui lui est affecté.',
  })
  create(
    @CurrentUser() user: AuthUser,
    @CompanyId() companyId: string,
    @Body() dto: CreateIncidentDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.incidents.create(user, companyId, dto, photo);
  }

  @Get()
  @Roles('CHAUFFEUR', 'GESTIONNAIRE')
  @ApiOperation({ summary: 'Incidents (un chauffeur ne voit que les siens)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @CompanyId() companyId: string,
    @Query() query: IncidentQueryDto,
  ) {
    return this.incidents.findAll(user, companyId, query);
  }

  @Get(':id')
  @Roles('CHAUFFEUR', 'GESTIONNAIRE')
  @ApiOperation({ summary: "Détail d'un incident" })
  findOne(
    @CurrentUser() user: AuthUser,
    @CompanyId() companyId: string,
    @Param('id', UuidPipe) id: string,
  ) {
    return this.incidents.findOne(user, companyId, id);
  }

  @Patch(':id')
  @Roles('GESTIONNAIRE')
  @ApiOperation({ summary: 'Traite un incident : statut, gravité, notes, clôture' })
  update(
    @CompanyId() companyId: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.incidents.update(companyId, id, dto);
  }

  @Post(':id/photo')
  @Roles('CHAUFFEUR', 'GESTIONNAIRE')
  @ApiFileUpload('photo', IncidentPhotoDto, PHOTO_HELP)
  @ApiOperation({ summary: "Ajoute ou remplace la photo d'un incident" })
  setPhoto(
    @CurrentUser() user: AuthUser,
    @CompanyId() companyId: string,
    @Param('id', UuidPipe) id: string,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.incidents.setPhoto(user, companyId, id, photo);
  }

  @Get(':id/photo')
  @Roles('CHAUFFEUR', 'GESTIONNAIRE')
  @ApiProduces('image/jpeg', 'image/png')
  @ApiOperation({ summary: "Photo de l'incident" })
  photo(
    @CurrentUser() user: AuthUser,
    @CompanyId() companyId: string,
    @Param('id', UuidPipe) id: string,
  ) {
    return this.incidents.photo(user, companyId, id);
  }
}
