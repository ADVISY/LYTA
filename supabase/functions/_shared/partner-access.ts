import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ResolvedPartnerAccess {
  authorized: boolean;
  normalizedEmail: string;
  tenantId: string | null;
  tenantSlug: string | null;
  partnerId: string | null;
  message?: string;
}

export async function resolvePartnerAccessByEmail(email: string): Promise<ResolvedPartnerAccess> {
  const normalizedEmail = email.toLowerCase().trim();
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: collaborateur, error: collabError } = await supabaseAdmin
    .from("clients")
    .select("id, tenant_id")
    .eq("email", normalizedEmail)
    .in("type_adresse", ["collaborateur", "partenaire"])
    .maybeSingle();

  if (collabError) {
    throw new Error(`Database error (collaborateur): ${collabError.message}`);
  }

  if (collaborateur?.tenant_id) {
    const [{ data: partnerRecord, error: partnerError }, { data: tenant, error: tenantError }] = await Promise.all([
      supabaseAdmin
        .from("partners")
        .select("id")
        .eq("user_id", collaborateur.id)
        .maybeSingle(),
      supabaseAdmin
        .from("tenants")
        .select("id, slug")
        .eq("id", collaborateur.tenant_id)
        .maybeSingle(),
    ]);

    if (partnerError) {
      throw new Error(`Database error (partner collaborateur): ${partnerError.message}`);
    }

    if (tenantError) {
      throw new Error(`Database error (tenant collaborateur): ${tenantError.message}`);
    }

    return {
      authorized: true,
      normalizedEmail,
      tenantId: collaborateur.tenant_id,
      tenantSlug: tenant?.slug ?? null,
      partnerId: partnerRecord?.id ?? null,
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Database error (profile): ${profileError.message}`);
  }

  if (!profile) {
    return {
      authorized: false,
      normalizedEmail,
      tenantId: null,
      tenantSlug: null,
      partnerId: null,
      message: "Partner not authorized or no tenant associated",
    };
  }

  const [{ data: assignment, error: assignmentError }, { data: rolesRows, error: rolesError }, { data: partnerRecord, error: partnerError }] = await Promise.all([
    supabaseAdmin
      .from("user_tenant_assignments")
      .select("tenant_id")
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id)
      .in("role", ["admin", "manager", "agent", "partner"]),
    supabaseAdmin
      .from("partners")
      .select("id")
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);

  if (assignmentError) {
    throw new Error(`Database error (assignment): ${assignmentError.message}`);
  }

  if (rolesError) {
    throw new Error(`Database error (roles): ${rolesError.message}`);
  }

  if (partnerError) {
    throw new Error(`Database error (partner profile): ${partnerError.message}`);
  }

  if (!assignment?.tenant_id || (!rolesRows?.length && !partnerRecord?.id)) {
    return {
      authorized: false,
      normalizedEmail,
      tenantId: assignment?.tenant_id ?? null,
      tenantSlug: null,
      partnerId: null,
      message: "Partner not authorized or no tenant associated",
    };
  }

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("id, slug")
    .eq("id", assignment.tenant_id)
    .maybeSingle();

  if (tenantError) {
    throw new Error(`Database error (tenant profile): ${tenantError.message}`);
  }

  return {
    authorized: true,
    normalizedEmail,
    tenantId: assignment.tenant_id,
    tenantSlug: tenant?.slug ?? null,
    partnerId: partnerRecord?.id ?? null,
  };
}
