const rawOrigins = Deno.env.get("ALLOWED_ORIGINS") || "";
const allowedOrigins = rawOrigins.split(",").map((s) => s.trim()).filter(Boolean);

function normalizeOriginValue(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isWildcardOriginPattern(value: string): boolean {
  return value.includes("://*.");
}

function matchesOriginPattern(origin: string, pattern: string): boolean {
  const normalizedOrigin = normalizeOriginValue(origin);
  const normalizedPattern = normalizeOriginValue(pattern);

  if (normalizedOrigin === normalizedPattern) {
    return true;
  }

  if (!isWildcardOriginPattern(normalizedPattern)) {
    return false;
  }

  try {
    const originUrl = new URL(normalizedOrigin);
    const wildcardUrl = new URL(normalizedPattern.replace("://*.", "://wildcard."));
    const baseHostname = wildcardUrl.hostname.replace(/^wildcard\./, "");

    if (!baseHostname) {
      return false;
    }

    return (
      originUrl.protocol === wildcardUrl.protocol &&
      originUrl.port === wildcardUrl.port &&
      originUrl.hostname !== baseHostname &&
      originUrl.hostname.endsWith(`.${baseHostname}`)
    );
  } catch {
    return false;
  }
}

function resolveAllowedOrigin(origin: string): string {
  const normalizedOrigin = normalizeOriginValue(origin);

  if (!normalizedOrigin) {
    return allowedOrigins.find((entry) => !isWildcardOriginPattern(entry)) || "";
  }

  const matchingPattern = allowedOrigins.find((entry) => matchesOriginPattern(normalizedOrigin, entry));

  if (matchingPattern) {
    return normalizedOrigin;
  }

  return allowedOrigins.find((entry) => !isWildcardOriginPattern(entry)) || "";
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = resolveAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    Vary: "Origin",
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  return null;
}
