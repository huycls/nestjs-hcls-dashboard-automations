const WEBHOOK_PATH =
  process.env.N8N_WEBHOOK_PATH ?? "68c98953-6269-4555-851e-670da5d87045";

function resolveWebhookUrl(kind: "test" | "production") {
  const testEnv =
    process.env.N8N_WEBHOOK_TEST_URL ??
    process.env.NEXT_PUBLIC_N8N_WEBHOOK_TEST_URL;
  const prodEnv =
    process.env.N8N_WEBHOOK_PROD_URL ??
    process.env.NEXT_PUBLIC_N8N_WEBHOOK_PROD_URL;
  const baseUrl =
    process.env.N8N_BASE_URL ?? process.env.NEXT_PUBLIC_N8N_BASE_URL;

  if (kind === "test" && testEnv) return testEnv;
  if (kind === "production" && prodEnv) return prodEnv;

  const root = (baseUrl ?? "http://localhost:5678").replace(/\/$/, "");
  const prefix = kind === "test" ? "webhook-test" : "webhook";

  return `${root}/${prefix}/${WEBHOOK_PATH}`;
}

export const N8N_WEBHOOK = {
  method: "POST" as const,
  testUrl: resolveWebhookUrl("test"),
  productionUrl: resolveWebhookUrl("production"),
  path: WEBHOOK_PATH,
  formField: "Topic" as const,
};

export const N8N_WEBHOOK_DISPLAY = N8N_WEBHOOK;

export function resolveTriggerWebhookUrl(
  useProduction: boolean,
  overrides?: { testUrl?: string; productionUrl?: string },
) {
  const custom = useProduction
    ? overrides?.productionUrl?.trim()
    : overrides?.testUrl?.trim();

  if (custom) return custom;

  return useProduction ? N8N_WEBHOOK.productionUrl : N8N_WEBHOOK.testUrl;
}
