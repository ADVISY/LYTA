import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new AuthError("Invalid or expired token");
  }

  return { user, supabase, token };
}

export async function requireTenantAccess(userId: string, tenantId: string): Promise<void> {
  if (!tenantId) throw new AuthError("tenant_id is required", 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data } = await supabase
    .from("user_tenant_assignments")
    .select("id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!data) {
    throw new AuthError("Access denied to this tenant", 403);
  }
}
