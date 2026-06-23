export type TriggerWebhookResult = {
  ok: boolean;
  status: number;
  message: string;
};

export async function triggerN8nWebhook(
  topic: string,
  useProduction = false,
  urls?: { testUrl?: string; productionUrl?: string },
): Promise<TriggerWebhookResult> {
  try {
    const response = await fetch("/api/n8n/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        useProduction,
        webhookTestUrl: urls?.testUrl,
        webhookProductionUrl: urls?.productionUrl,
      }),
    });

    return (await response.json()) as TriggerWebhookResult;
  } catch {
    return {
      ok: false,
      status: 0,
      message: "Failed to send trigger request. Please try again.",
    };
  }
}
