const rawOrigins = Deno.env.get("ALLOWED_ORIGINS") || "";
const allowedOrigins = rawOrigins.split(",").map((s) => s.trim()).filter(Boolean);

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const isAllowed = allowedOrigins.length > 0 && allowedOrigins.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : (allowedOrigins[0] || ""),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  return null;
}
