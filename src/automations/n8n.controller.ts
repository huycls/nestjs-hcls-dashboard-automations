import { Body, Controller, Post } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { TriggerWorkflowDto } from './dto/trigger-workflow.dto';
import { N8nService } from './n8n.service';

@Controller('n8n')
export class N8nController {
  constructor(
    private readonly automationsService: AutomationsService,
    private readonly n8nService: N8nService,
  ) {}

  /** Backward-compatible — nhận workflowId thay vì full webhook config */
  @Post('webhook')
  async triggerWebhook(@Body() body: TriggerWorkflowDto) {
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
}
