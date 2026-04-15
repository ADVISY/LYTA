import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { supabaseConfig } from "@/integrations/supabase/config";

type JsonRecord = Record<string, unknown>;

interface InvokeSupabaseFunctionOptions {
  body?: unknown;
  headers?: Record<string, string>;
  requireAuth?: boolean;
}

function asMessage(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;

    try {
      const payload = (await error.context.clone().json()) as JsonRecord;
      return (
        asMessage(payload.error) ||
        asMessage(payload.message) ||
        asMessage(payload.details) ||
        `Erreur de service (${status})`
      );
    } catch {
      try {
        const text = await error.context.clone().text();
        return text || `Erreur de service (${status})`;
      } catch {
        return error.message || `Erreur de service (${status})`;
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Erreur inconnue";
}

function isExpiredTokenMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("invalid or expired token") || normalized.includes("jwt expired");
}

function isTransientNetworkMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("load failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network request failed") ||
    normalized.includes("networkerror")
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getFreshAccessToken(forceRefresh = false): Promise<string> {
  const {
    data: { session: currentSession },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  let session = currentSession;
  const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;

  if (session?.refresh_token && (forceRefresh || expiresAtMs === 0 || expiresAtMs < Date.now() + 60_000)) {
    const {
      data: { session: refreshedSession },
      error: refreshError,
    } = await supabase.auth.refreshSession();

    if (refreshError) {
      throw new Error("Votre session a expiré. Veuillez vous reconnecter.");
    }

    session = refreshedSession;
  }

  if (!session?.access_token) {
    throw new Error("Non authentifié. Veuillez vous reconnecter.");
  }

  return session.access_token;
}

async function parseFunctionResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

async function invokeWithToken<T>(
  name: string,
  options: InvokeSupabaseFunctionOptions,
  forceRefresh: boolean,
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");

  if (options.requireAuth !== false) {
    headers.set("Authorization", `Bearer ${await getFreshAccessToken(forceRefresh)}`);
  }

  const response = await fetch(`${supabaseConfig.url}/functions/v1/${name}`, {
    method: "POST",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await parseFunctionResponse(response);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object"
        ? asMessage((payload as JsonRecord).error) ||
          asMessage((payload as JsonRecord).message) ||
          asMessage((payload as JsonRecord).details)
        : null;

    throw new Error(message || `Erreur de service (${response.status})`);
  }

  if (payload && typeof payload === "object" && "error" in payload && payload.error) {
    throw new Error(String(payload.error));
  }

  return payload as T;
}

export async function invokeSupabaseFunction<T = unknown>(
  name: string,
  options: InvokeSupabaseFunctionOptions = {},
): Promise<T> {
  try {
    return await invokeWithToken<T>(name, options, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (options.requireAuth !== false && isExpiredTokenMessage(message)) {
      return await invokeWithToken<T>(name, options, true);
    }

    if (isTransientNetworkMessage(message)) {
      try {
        await sleep(500);
        return await invokeWithToken<T>(name, options, false);
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : "";
        if (options.requireAuth !== false && isExpiredTokenMessage(retryMessage)) {
          return await invokeWithToken<T>(name, options, true);
        }

        if (isTransientNetworkMessage(retryMessage)) {
          throw new Error("Connexion au service interrompue. Veuillez reessayer dans quelques secondes.");
        }

        throw retryError;
      }
    }

    throw error;
  }
}
