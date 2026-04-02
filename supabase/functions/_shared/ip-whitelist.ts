import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class IpWhitelistError extends Error {
  status: number;
  constructor(message = "Accès refusé - IP non autorisée", status = 403) {
    super(message);
    this.status = status;
  }
}

/**
 * Check if the request IP is allowed by the KING IP whitelist.
 * If whitelist is disabled or empty, allows all requests (passthrough).
 */
export async function checkKingIpWhitelist(req: Request): Promise<void> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Check if IP whitelist is enabled
  const { data: whitelistEnabled } = await supabaseAdmin.rpc(
    "get_platform_setting",
    { setting_key: "king_ip_whitelist_enabled" }
  );

  if (whitelistEnabled !== true && whitelistEnabled !== "true") {
    return; // Whitelist disabled, allow all
  }

  // Get client IP from headers
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const clientIp = forwarded?.split(",")[0]?.trim() || realIp || null;

  if (!clientIp) {
    // Cannot determine IP — fail open to avoid lockout during misconfiguration
    return;
  }

  // Check if whitelist has any entries (empty whitelist = allow all, misconfiguration protection)
  const { data: entries, error: listError } = await supabaseAdmin
    .from("king_ip_whitelist")
    .select("id")
    .limit(1);

  if (listError || !entries || entries.length === 0) {
    return; // Empty whitelist — allow all
  }

  // Check if client IP is in whitelist using CIDR matching
  const { data: isAllowed } = await supabaseAdmin.rpc(
    "check_ip_in_whitelist",
    { check_ip: clientIp }
  );

  if (!isAllowed) {
    throw new IpWhitelistError(
      `Accès refusé - IP ${clientIp} non autorisée`
    );
  }
}
