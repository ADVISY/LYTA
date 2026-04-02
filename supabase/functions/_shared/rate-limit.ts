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

export async function checkRateLimit(
  req: Request,
  endpoint: string,
  maxPerHour = 10
): Promise<void> {
  const identifier =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Current hour window (aligned to hour boundary)
  const now = new Date();
  const windowHour = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()
  ).toISOString();

  // Check existing count for this window
  const { data: existing } = await supabase
    .from("api_rate_limits")
    .select("id, request_count")
    .eq("identifier", identifier)
    .eq("endpoint", endpoint)
    .eq("window_hour", windowHour)
    .maybeSingle();

  if (existing) {
    if ((existing.request_count || 0) >= maxPerHour) {
      const minutesLeft = 60 - now.getMinutes();
      throw new RateLimitError(minutesLeft * 60);
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
