const DEFAULT_AI_GATEWAY_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_AI_MODEL = "gpt-5.4-mini";

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

export function getAiGatewayUrl(): string {
  return Deno.env.get("AI_GATEWAY_URL") ?? DEFAULT_AI_GATEWAY_URL;
}

export async function buildAiError(response: Response): Promise<Error> {
  let details = "";
  let code = "";
  let type = "";

  try {
    const payload = await response.clone().json();
    const message =
      payload?.error?.message ||
      payload?.message ||
      payload?.error ||
      "";
    details = typeof message === "string" ? message : JSON.stringify(message);
    code = typeof payload?.error?.code === "string" ? payload.error.code : "";
    type = typeof payload?.error?.type === "string" ? payload.error.type : "";
  } catch {
    try {
      details = await response.clone().text();
    } catch {
      details = "";
    }
  }

  if (response.status === 401 || response.status === 403) {
    return new Error(
      "Configuration IA invalide: la cle API est refusee par le fournisseur. Verifiez OPENAI_API_KEY ou configurez AI_GATEWAY_API_KEY/AI_GATEWAY_URL.",
    );
  }

  if (response.status === 429) {
    if (
      code === "insufficient_quota" ||
      type === "insufficient_quota" ||
      details.toLowerCase().includes("exceeded your current quota")
    ) {
      return new Error(
        "Quota OpenAI insuffisant: verifiez le billing et les credits du projet OpenAI associe a OPENAI_API_KEY.",
      );
    }

    return new Error(`Trop de requetes IA.${details ? ` ${details}` : " Reessayez dans quelques instants."}`);
  }

  if (response.status === 402) {
    return new Error("Credits IA insuffisants. Contactez l'administrateur.");
  }

  return new Error(`AI request failed: ${response.status}${details ? ` - ${details}` : ""}`);
}

export async function fetchAiChatCompletions(
  payload: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(getAiGatewayUrl(), {
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
