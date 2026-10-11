import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompanyId, Roles } from '../auth/decorators';
import { UuidPipe } from '../common/uuid.pipe';
import { AssignmentsService } from './assignments.service';
import {
  AssignmentQueryDto,
  CreateAssignmentDto,
  EndAssignmentDto,
  UpdateAssignmentDto,
} from './dto/assignment.dto';

@ApiTags('Assignments')
@ApiBearerAuth()
@Roles('GESTIONNAIRE')
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Affecte un chauffeur à un véhicule' })
  create(@CompanyId() companyId: string, @Body() dto: CreateAssignmentDto) {
    return this.assignments.create(companyId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Historique des affectations (filtrable : en cours, véhicule, chauffeur)',
  })
  findAll(@CompanyId() companyId: string, @Query() query: AssignmentQueryDto) {
    return this.assignments.findAll(companyId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une affectation" })
  findOne(@CompanyId() companyId: string, @Param('id', UuidPipe) id: string) {
    return this.assignments.findOne(companyId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Corrige les dates d'une affectation" })
  update(
    @CompanyId() companyId: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.assignments.update(companyId, id, dto);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Termine l'affectation en cours" })
  end(
    @CompanyId() companyId: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: EndAssignmentDto,
  ) {
    return this.assignments.end(companyId, id, dto);
  }
}
