import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UserDocument } from '../auth/schemas/user.schema';
import { WORKFLOW_TYPES, type WorkflowType } from './data';
import { AutomationsService } from './automations.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { TriggerWorkflowDto } from './dto/trigger-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { UpdateWorkflowConfigDto } from './dto/update-workflow-config.dto';
import { UpsertNodeCredentialDto } from './dto/upsert-node-credential.dto';
import { UpdateNodeConfigDto } from './dto/update-node-config.dto';
import { N8nService } from './n8n.service';
import { WORKFLOW_TEMPLATES } from './workflow-templates';

@Controller('automations')
@UseGuards(JwtAuthGuard)
export class AutomationsController {
  constructor(
    private readonly automationsService: AutomationsService,
    private readonly n8nService: N8nService,
  ) {}

  /** Workflows của user + lịch sử chạy liên quan */
  @Get()
  findAll(@CurrentUser() user: UserDocument) {
    return this.automationsService.findAll(user._id.toString());
  }

  @Get('jobs')
  findAllJobs(
    @CurrentUser() user: UserDocument,
    @Query('workflowId') workflowId?: string,
  ) {
    return this.automationsService.findAllJobs(
      user._id.toString(),
      workflowId,
    );
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

  /** Web chỉ cần gửi workflowId — Nest resolve credentials từ user owner */
  @Post('trigger')
  async trigger(
    @CurrentUser() user: UserDocument,
    @Body() body: TriggerWorkflowDto,
  ) {
    const context = await this.automationsService.resolveForTrigger(
      body.workflowId,
      body.topic,
      user._id.toString(),
    );

    const result = await this.n8nService.triggerWorkflow(context);

    if (result.ok) {
      await this.automationsService.incrementTriggers(body.workflowId);
    }

    return result;
  }

  @Get(':id')
  findOne(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.automationsService.findOne(id, user._id.toString());
  }

  @Post()
  create(
    @CurrentUser() user: UserDocument,
    @Body() body: CreateWorkflowDto,
  ) {
    return this.automationsService.create(body, user._id.toString());
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() body: UpdateWorkflowDto,
  ) {
    return this.automationsService.update(id, body, user._id.toString());
  }

  @Patch(':id/config')
  updateConfig(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() config: UpdateWorkflowConfigDto,
  ) {
    return this.automationsService.updateConfig(
      id,
      config,
      user._id.toString(),
    );
  }

  @Patch(':id/node-credentials')
  upsertNodeCredentials(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() nodes: UpsertNodeCredentialDto[],
  ) {
    return this.automationsService.upsertNodeCredentials(
      id,
      nodes,
      user._id.toString(),
    );
  }

  /** Save FE node config (topic + credentials) — load lại mỗi lần vào editor */
  @Patch(':id/node-config')
  updateNodeConfig(
    @Param('id') id: string,
    @Body() body: UpdateNodeConfigDto,
  ) {
    return this.automationsService.updateNodeConfig(id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.automationsService
      .remove(id, user._id.toString())
      .then(() => ({ ok: true }));
  }

  @Post(':id/trigger')
  async triggerById(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() body: Pick<TriggerWorkflowDto, 'topic'>,
  ) {
    const context = await this.automationsService.resolveForTrigger(
      id,
      body.topic,
      user._id.toString(),
    );

    const result = await this.n8nService.triggerWorkflow(context);

    if (result.ok) {
      await this.automationsService.incrementTriggers(id);
    }

    return result;
  }
}
