import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AutomationsService } from '../automations/automations.service';
import { N8N_WEBHOOK } from '../automations/n8n-server';

const TEST_WORKFLOW_NAME = 'Test — Generate Ideas';

async function seedTestWorkflow() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const automationsService = app.get(AutomationsService);

  const existing = (await automationsService.findAll()).find(
    (workflow) => workflow.name === TEST_WORKFLOW_NAME,
  );

  if (existing) {
    const fixed = await automationsService.updateConfig(existing.id, {
      useProductionWebhook: true,
      webhookTestUrl: N8N_WEBHOOK.testUrl,
      webhookProductionUrl: N8N_WEBHOOK.productionUrl,
    });
    console.log(`Updated webhook URLs for: ${fixed.id}`);
    console.log(JSON.stringify(fixed.config, null, 2));
    await app.close();
    return;
  }

  const workflow = await automationsService.create({
    name: TEST_WORKFLOW_NAME,
    type: 'generate-idea-posts',
    config: {
      topic: 'AI marketing trends',
      useProductionWebhook: true,
      webhookTestUrl: N8N_WEBHOOK.testUrl,
      webhookProductionUrl: N8N_WEBHOOK.productionUrl,
    },
    nodeCredentials: [
      { nodeTypeId: 'webhook', credentialId: 'n8n-cred-webhook-test' },
      { nodeTypeId: 'gemini-model', credentialId: 'n8n-cred-gemini-test' },
      { nodeTypeId: 'openrouter-model', credentialId: 'n8n-cred-openrouter-test' },
      { nodeTypeId: 'google-sheet', credentialId: 'n8n-cred-sheets-test' },
    ],
  });

  console.log('Created test workflow (no siteId):');
  console.log(JSON.stringify(workflow, null, 2));
  console.log(`\nTrigger from FE:\nPOST /api/jobs/run\n{ "workflowId": "${workflow.id}", "topic": "your topic" }`);

  await app.close();
}

seedTestWorkflow().catch((error) => {
  console.error(error);
  process.exit(1);
});
