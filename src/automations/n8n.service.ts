import { Injectable, Logger } from '@nestjs/common';
import { workflowRequiresTopic } from './data';
import { resolveTriggerWebhookUrl, getN8nWebhookForType } from './n8n-server';
import type { N8nJobContext, TriggerWebhookResult } from './n8n.types';
import type { WorkflowTriggerContext } from './workflow.mapper';

function formatN8nError(responseText: string, status: number, url: string) {
  try {
    const parsed = JSON.parse(responseText) as {
      message?: string;
      hint?: string;
    };

    const parts = [parsed.message, parsed.hint].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' — ');
    }
  } catch {
    // not JSON
  }

  if (url.includes('/webhook-test/')) {
    return `n8n test webhook ${status}: bấm "Listen for test event" trên Webhook node, rồi trigger ngay (chỉ 1 lần mỗi lần listen).`;
  }

  return `n8n production webhook ${status}: bật Active workflow (toggle góc phải editor).`;
}

@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);

  async triggerJob(context: N8nJobContext): Promise<TriggerWebhookResult> {
    return this.postToWebhook(context, {
      jobId: context.jobId,
      siteId: context.siteId,
      callbackUrl: context.callbackUrl,
      errorUrl: context.errorUrl,
      successUrl: context.successUrl,
    });
  }

  /** @deprecated Dùng JobsService.run — giữ cho backward-compat */
  async triggerWorkflow(
    context: WorkflowTriggerContext,
  ): Promise<TriggerWebhookResult> {
    return this.postToWebhook(context);
  }

  private async postToWebhook(
    context: WorkflowTriggerContext,
    meta?: {
      jobId?: string;
      siteId?: string | null;
      callbackUrl?: string;
      errorUrl?: string;
      successUrl?: string;
    },
  ): Promise<TriggerWebhookResult> {
    const requiresTopic = workflowRequiresTopic(context.workflowType);
    const topic = context.topic?.trim();

    if (requiresTopic && !topic) {
      return {
        ok: false,
        status: 400,
        message:
          'Topic is required. Set it on the workflow config or in the request.',
        workflowId: context.workflowId,
        jobId: meta?.jobId,
      };
    }

    const webhook = getN8nWebhookForType(context.workflowType);
    const url = resolveTriggerWebhookUrl(
      context.workflowType,
      context.config.useProductionWebhook,
      {
        testUrl: context.config.webhookTestUrl,
        productionUrl: context.config.webhookProductionUrl,
      },
    );

    const body: Record<string, unknown> = {
      workflowId: context.workflowId,
      workflowType: context.workflowType,
      jobId: meta?.jobId,
      siteId: meta?.siteId ?? undefined,
      callbackUrl: meta?.callbackUrl,
      errorUrl: meta?.errorUrl,
      successUrl: meta?.successUrl,
      credentials: {
        ...Object.fromEntries(
          context.nodeCredentials.map((node) => [
            node.nodeTypeId,
            {
              credentialId: node.credentialId,
              config: node.config ?? {},
            },
          ]),
        ),
        // Approach C — flat fields for n8n expressions
        openRouterApiKey: context.credentials?.openRouterApiKey ?? '',
        model: context.credentials?.model ?? '',
        spreadsheetId: context.credentials?.spreadsheetId ?? '',
      },
    };

    if (topic) {
      body[webhook.formField] = topic;
      body.topic = topic;
    }

    this.logger.log(`POST n8n webhook → ${url}`);
    this.logger.debug(`Payload: ${JSON.stringify(body)}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      const message = response.ok
        ? 'n8n webhook triggered successfully.'
        : formatN8nError(responseText, response.status, url);

      if (!response.ok) {
        this.logger.warn(
          `n8n webhook failed (${response.status}): ${message}`,
        );
      }

      return {
        ok: response.ok,
        status: response.status,
        message,
        workflowId: context.workflowId,
        jobId: meta?.jobId,
        webhookUrl: url,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to reach n8n webhook. Is n8n running on localhost:5678?';

      this.logger.error(`n8n webhook unreachable: ${message}`);

      return {
        ok: false,
        status: 0,
        message,
        workflowId: context.workflowId,
        jobId: meta?.jobId,
        webhookUrl: url,
      };
    }
  }
}
