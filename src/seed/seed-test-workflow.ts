import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../app.module';
import { AutomationsService } from '../automations/automations.service';
import type { WorkflowType } from '../automations/data';
import { getN8nWebhookForType } from '../automations/n8n-server';
import { CredentialsService } from '../credentials/credentials.service';
import { User, UserDocument } from '../auth/schemas/user.schema';

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
  const credentialsService = app.get(CredentialsService);
  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@hcls.local';
  const admin = await userModel.findOne({ email: adminEmail }).exec();

  if (!admin) {
    throw new Error(
      `Admin user ${adminEmail} not found — chạy seed:admin trước`,
    );
  }

  const userId = admin._id.toString();

  const google = await upsertCredential(credentialsService, userId, {
    type: 'google-oauth',
    label: 'Seed Google OAuth',
    n8nCredentialId: 'n8n-cred-sheets-test',
  });

  const apiKey = await upsertCredential(credentialsService, userId, {
    type: 'api-key',
    label: 'Seed Gemini API Key',
    n8nCredentialId: 'n8n-cred-gemini-test',
  });

  const wordpress = await upsertCredential(credentialsService, userId, {
    type: 'wordpress',
    label: 'Seed WordPress',
    data: {
      siteUrl: 'https://example.com',
      username: 'editor',
      appPassword: 'xxxx xxxx xxxx xxxx',
    },
  });

  for (const seed of SEED_WORKFLOWS) {
    const webhook = getN8nWebhookForType(seed.type);
    const existing = (await automationsService.findAll(userId)).workflows.find(
      (workflow) => workflow.name === seed.name,
    );

    if (existing) {
      const fixed = await automationsService.updateConfig(
        existing.id,
        {
          useProductionWebhook: true,
          webhookTestUrl: webhook.testUrl,
          webhookProductionUrl: webhook.productionUrl,
          googleOAuth: { credentialId: google.id },
          ...(seed.type === 'generate-idea-posts'
            ? { apiKeyCredentialId: apiKey.id }
            : { wordpressCredentialId: wordpress.id }),
        },
        userId,
      );
      console.log(`Updated [${seed.type}]: ${fixed.id}`);
      console.log(JSON.stringify(fixed.config, null, 2));
      continue;
    }

    const workflow = await automationsService.create(
      {
        name: seed.name,
        type: seed.type,
        config:
          seed.type === 'generate-idea-posts'
            ? {
                topic: 'AI marketing trends',
                useProductionWebhook: true,
                webhookTestUrl: webhook.testUrl,
                webhookProductionUrl: webhook.productionUrl,
                googleOAuth: { credentialId: google.id },
                apiKeyCredentialId: apiKey.id,
              }
            : {
                useProductionWebhook: true,
                webhookTestUrl: webhook.testUrl,
                webhookProductionUrl: webhook.productionUrl,
                googleOAuth: { credentialId: google.id },
                wordpressCredentialId: wordpress.id,
              },
      },
      userId,
    );

    console.log(`Created [${seed.type}]: ${workflow.id}`);
    console.log(JSON.stringify(workflow.config, null, 2));
  }

  await app.close();
}

async function upsertCredential(
  credentialsService: CredentialsService,
  userId: string,
  dto: {
    type: 'google-oauth' | 'api-key' | 'wordpress';
    label: string;
    n8nCredentialId?: string;
    data?: Record<string, string>;
  },
) {
  const existing = (
    await credentialsService.findAllByUserAndType(userId, dto.type)
  ).find((item) => item.label === dto.label);

  if (existing) {
    return credentialsService.update(userId, existing.id, {
      n8nCredentialId: dto.n8nCredentialId,
      data: dto.data,
    });
  }

  return credentialsService.create(userId, dto);
}

seedTestWorkflow().catch((error) => {
  console.error(error);
  process.exit(1);
});
