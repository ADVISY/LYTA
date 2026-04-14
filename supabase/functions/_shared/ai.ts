const DEFAULT_AI_GATEWAY_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_AI_MODEL = "gpt-5-mini";

type AiErrorPayload = {
  message: string;
  code: string;
  type: string;
};

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

function shouldUseDefaultSampling(model: unknown): boolean {
  if (typeof model !== "string") {
    return false;
  }

  const normalizedModel = model.toLowerCase();
  return normalizedModel.startsWith("gpt-5") || /^o\d/.test(normalizedModel);
}

function extractAiErrorPayload(payload: unknown): AiErrorPayload {
  if (!payload || typeof payload !== "object") {
    return { message: "", code: "", type: "" };
  }

  const record = payload as Record<string, unknown>;
  const error = record.error && typeof record.error === "object"
    ? record.error as Record<string, unknown>
    : null;
  const rawMessage = error?.message ?? record.message ?? record.error ?? "";
  const message = typeof rawMessage === "string" ? rawMessage : JSON.stringify(rawMessage);

  return {
    message,
    code: typeof error?.code === "string" ? error.code : "",
    type: typeof error?.type === "string" ? error.type : "",
  };
}

export function buildAiErrorFromPayload(status: number, payload: AiErrorPayload): Error {
  const details = payload.message;
  const code = payload.code;
  const type = payload.type;

  if (status === 400) {
    return new Error(`Requete IA invalide.${details ? ` ${details}` : ""}`);
  }

  if (status === 401 || status === 403) {
    return new Error(
      "Configuration IA invalide: la cle API est refusee par le fournisseur. Verifiez OPENAI_API_KEY ou configurez AI_GATEWAY_API_KEY/AI_GATEWAY_URL.",
    );
  }

  if (status === 429) {
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

  if (status === 402) {
    return new Error("Credits IA insuffisants. Contactez l'administrateur.");
  }

  return new Error(`AI request failed: ${status}${details ? ` - ${details}` : ""}`);
}

export async function buildAiError(response: Response): Promise<Error> {
  try {
    return buildAiErrorFromPayload(response.status, extractAiErrorPayload(await response.clone().json()));
  } catch {
    try {
      return buildAiErrorFromPayload(response.status, {
        message: await response.clone().text(),
        code: "",
        type: "",
      });
    } catch {
      return buildAiErrorFromPayload(response.status, { message: "", code: "", type: "" });
    }
  }
}

export async function fetchAiChatCompletions(
  payload: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const normalizedPayload = { ...payload };
    if (
      "max_tokens" in normalizedPayload &&
      !("max_completion_tokens" in normalizedPayload)
    ) {
      normalizedPayload.max_completion_tokens = normalizedPayload.max_tokens;
      delete normalizedPayload.max_tokens;
    }

    if (
      shouldUseDefaultSampling(normalizedPayload.model) &&
      "temperature" in normalizedPayload &&
      normalizedPayload.temperature !== 1
    ) {
      delete normalizedPayload.temperature;
    }

    return await fetch(getAiGatewayUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAiGatewayApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(normalizedPayload),
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
