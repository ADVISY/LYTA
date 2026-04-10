import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class RateLimitError extends Error {
  status: number;
  retryAfter: number;
  constructor(retryAfter: number) {
    super("Rate limit exceeded");
    this.status = 429;
    this.retryAfter = retryAfter;
  }
}

interface CheckRateLimitOptions {
  identifier?: string;
  maxPerWindow?: number;
  windowMs?: number;
}

export async function checkRateLimit(
  req: Request,
  endpoint: string,
  maxPerHourOrOptions: number | CheckRateLimitOptions = 10
): Promise<void> {
  const options =
    typeof maxPerHourOrOptions === "number"
      ? { maxPerWindow: maxPerHourOrOptions }
      : maxPerHourOrOptions;

  const maxPerWindow = options.maxPerWindow ?? 10;
  const windowMs = options.windowMs ?? 60 * 60 * 1000;
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-real-ip")?.trim();
  const identifier = options.identifier?.trim() || forwardedFor || realIp || "unknown";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const nowMs = Date.now();
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const windowHour = new Date(windowStartMs).toISOString();

  // Check existing count for this window
  const { data: existing } = await supabase
    .from("api_rate_limits")
    .select("id, request_count")
    .eq("identifier", identifier)
    .eq("endpoint", endpoint)
    .eq("window_hour", windowHour)
    .maybeSingle();

  if (existing) {
    if ((existing.request_count || 0) >= maxPerWindow) {
      const retryAfter = Math.max(1, Math.ceil((windowStartMs + windowMs - nowMs) / 1000));
      throw new RateLimitError(retryAfter);
    }
    // Increment counter
    await supabase
      .from("api_rate_limits")
      .update({ request_count: (existing.request_count || 0) + 1 })
      .eq("id", existing.id);
  } else {
    // First request in this window
    await supabase.from("api_rate_limits").insert({
      identifier,
      endpoint,
      window_hour: windowHour,
      request_count: 1,
    });
  }
}
