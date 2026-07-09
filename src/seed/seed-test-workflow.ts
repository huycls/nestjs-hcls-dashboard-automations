import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AutomationsService } from '../automations/automations.service';
import type { WorkflowType } from '../automations/data';
import { getN8nWebhookForType } from '../automations/n8n-server';

const SEED_WORKFLOWS: Array<{
  name: string;
  type: WorkflowType;
}> = [
  { name: 'Test — Generate Ideas', type: 'generate-idea-posts' },
  { name: 'Test — Generate Content Post', type: 'generate-content-post' },
];

async function seedTestWorkflow() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const automationsService = app.get(AutomationsService);

  for (const seed of SEED_WORKFLOWS) {
    const webhook = getN8nWebhookForType(seed.type);
    const existing = (await automationsService.findAll()).workflows.find(
      (workflow) => workflow.name === seed.name,
    );

    if (existing) {
      const fixed = await automationsService.updateConfig(existing.id, {
        useProductionWebhook: true,
        webhookTestUrl: webhook.testUrl,
        webhookProductionUrl: webhook.productionUrl,
      });
      console.log(`Updated [${seed.type}]: ${fixed.id}`);
      console.log(JSON.stringify(fixed.config, null, 2));
      continue;
    }

    const workflow = await automationsService.create({
      name: seed.name,
      type: seed.type,
      config: {
        topic: 'AI marketing trends',
        useProductionWebhook: true,
        webhookTestUrl: webhook.testUrl,
        webhookProductionUrl: webhook.productionUrl,
      },
      nodeCredentials: [
        { nodeTypeId: 'webhook', credentialId: 'n8n-cred-webhook-test' },
        { nodeTypeId: 'gemini-model', credentialId: 'n8n-cred-gemini-test' },
        {
          nodeTypeId: 'openrouter-model',
          credentialId: 'n8n-cred-openrouter-test',
        },
        { nodeTypeId: 'google-sheet', credentialId: 'n8n-cred-sheets-test' },
      ],
    });

    console.log(`Created [${seed.type}]: ${workflow.id}`);
    console.log(JSON.stringify(workflow.config, null, 2));
  }

  await app.close();
}

seedTestWorkflow().catch((error) => {
  console.error(error);
  process.exit(1);
});
