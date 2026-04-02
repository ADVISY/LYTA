const DEFAULT_AI_GATEWAY_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_AI_MODEL = "gpt-4o-mini";

function getAiGatewayApiKey(): string {
  const apiKey =
    Deno.env.get("AI_GATEWAY_API_KEY") ??
    Deno.env.get("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY (or OPENAI_API_KEY fallback) is not configured");
  }

  return apiKey;
}

export function getAiModel(): string {
  return Deno.env.get("AI_MODEL") ?? DEFAULT_AI_MODEL;
}

export async function fetchAiChatCompletions(
  payload: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(Deno.env.get("AI_GATEWAY_URL") ?? DEFAULT_AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAiGatewayApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`AI request timed out after ${Math.ceil(timeoutMs / 1000)} seconds`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
