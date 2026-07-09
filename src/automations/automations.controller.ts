import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { WORKFLOW_TYPES, type WorkflowType } from './data';
import { AutomationsService } from './automations.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { TriggerWorkflowDto } from './dto/trigger-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { UpdateWorkflowConfigDto } from './dto/update-workflow-config.dto';
import { UpsertNodeCredentialDto } from './dto/upsert-node-credential.dto';
import { N8nService } from './n8n.service';
import { WORKFLOW_TEMPLATES } from './workflow-templates';

@Controller('automations')
export class AutomationsController {
  constructor(
    private readonly automationsService: AutomationsService,
    private readonly n8nService: N8nService,
  ) {}

  /** Workflows từ `workflows` + lịch sử chạy từ `automation_jobs` */
  @Get()
  findAll() {
    return this.automationsService.findAll();
  }

  @Get('jobs')
  findAllJobs(@Query('workflowId') workflowId?: string) {
    return this.automationsService.findAllJobs(workflowId);
  }

  @Get('types')
  getTypes() {
    return WORKFLOW_TYPES;
  }

  @Get('templates')
  getTemplates() {
    return WORKFLOW_TEMPLATES;
  }

  @Get('templates/:type')
  getTemplate(@Param('type') type: WorkflowType) {
    return WORKFLOW_TEMPLATES[type];
  }

  /** Web chỉ cần gửi workflowId — NestJS tự lookup config + credentials từ DB */
  @Post('trigger')
  async trigger(@Body() body: TriggerWorkflowDto) {
    const context = await this.automationsService.resolveForTrigger(
      body.workflowId,
      body.topic,
    );

    const result = await this.n8nService.triggerWorkflow(context);

    if (result.ok) {
      await this.automationsService.incrementTriggers(body.workflowId);
    }

    return result;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.automationsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateWorkflowDto) {
    return this.automationsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateWorkflowDto) {
    return this.automationsService.update(id, body);
  }

  @Patch(':id/config')
  updateConfig(
    @Param('id') id: string,
    @Body() config: UpdateWorkflowConfigDto,
  ) {
    return this.automationsService.updateConfig(id, config);
  }

  @Patch(':id/node-credentials')
  upsertNodeCredentials(
    @Param('id') id: string,
    @Body() nodes: UpsertNodeCredentialDto[],
  ) {
    return this.automationsService.upsertNodeCredentials(id, nodes);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.automationsService.remove(id).then(() => ({ ok: true }));
  }

  @Post(':id/trigger')
  async triggerById(
    @Param('id') id: string,
    @Body() body: Pick<TriggerWorkflowDto, 'topic'>,
  ) {
    const context = await this.automationsService.resolveForTrigger(
      id,
      body.topic,
    );

    const result = await this.n8nService.triggerWorkflow(context);

    if (result.ok) {
      await this.automationsService.incrementTriggers(id);
    }

    return result;
  }
}
