import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

async function getFreshAccessToken(): Promise<string> {
  const {
    data: { session: currentSession },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  let session = currentSession;
  const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;

  if (session?.refresh_token && expiresAtMs > 0 && expiresAtMs < Date.now() + 30_000) {
    const {
      data: { session: refreshedSession },
      error: refreshError,
    } = await supabase.auth.refreshSession();

    if (refreshError) {
      throw new Error("Votre session a expire. Veuillez vous reconnecter.");
    }

    session = refreshedSession;
  }

  if (!session?.access_token) {
    throw new Error("Non authentifie. Veuillez vous reconnecter.");
  }

  return session.access_token;
}

export async function invokeSupabaseFunction<T = unknown>(
  name: string,
  options: InvokeSupabaseFunctionOptions = {},
): Promise<T> {
  const headers = { ...(options.headers ?? {}) };

  if (options.requireAuth !== false) {
    headers.Authorization = `Bearer ${await getFreshAccessToken()}`;
  }

  const { data, error } = await supabase.functions.invoke(name, {
    body: options.body,
    headers,
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }

  return data as T;
}
