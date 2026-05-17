/**
 * king-impersonate-tenant
 * =======================
 * King-only : génère un magic link de connexion pour un user admin du tenant.
 * Permet au support LYTA de se connecter "comme" un user du cabinet pour
 * débugger sans avoir besoin du mot de passe.
 *
 * Body : { tenant_id: "uuid", target_user_id?: "uuid" }
 *   - Si target_user_id absent : utilise le 1er admin du tenant
 *
 * Loggé dans king_audit_log avec action_type='tenant.impersonate'.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { auditLog } from "../_shared/audit-log.ts";

const log = createLogger("king-impersonate-tenant");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const { user } = await requireAuth(req);
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isKing = (roles || []).some((r: any) => r.role === "king");
    if (!isKing) throw new AuthError("Forbidden — king required", 403);

    const body = (await req.json().catch(() => ({}))) as { tenant_id?: string; target_user_id?: string };
    if (!body.tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: tenant } = await supabase
      .from("tenants").select("id, name, slug")
      .eq("id", body.tenant_id).maybeSingle();
    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant introuvable" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Trouver le user à impersonate (target_user_id fourni ou 1er admin du tenant)
    let targetUserId: string | null = body.target_user_id || null;
    let targetEmail: string | null = null;

    if (!targetUserId) {
      // 1er admin attaché au tenant
      const { data: assignment } = await supabase
        .from("user_tenant_assignments")
        .select("user_id")
        .eq("tenant_id", tenant.id)
        .limit(1)
        .maybeSingle();
      targetUserId = assignment?.user_id ?? null;
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Aucun user trouvé pour ce tenant" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Récupère l'email du user pour generateLink
    const { data: userInfo, error: userErr } = await supabase.auth.admin.getUserById(targetUserId);
    if (userErr || !userInfo?.user?.email) {
      return new Response(JSON.stringify({ error: "Email user introuvable" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    targetEmail = userInfo.user.email;

    const redirectTo = `https://${tenant.slug}.lyta.ch/crm`;
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      log.error("generateLink failed", { linkErr });
      return new Response(JSON.stringify({ error: "Magic link impossible", details: linkErr?.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const impersonateUrl = linkData.properties.action_link;

    // Audit log
    await auditLog({
      actionType: "tenant.impersonate",
      actorUserId: user.id,
      actorRole: "king",
      actorEmail: user.email,
      targetType: "tenant",
      targetId: tenant.id,
      targetLabel: tenant.name,
      metadata: {
        target_user_id: targetUserId,
        target_email: targetEmail,
        slug: tenant.slug,
      },
    });

    // Notif king pour traçabilité
    await supabase.from("king_notifications").insert({
      title: "🔓 Impersonation tenant",
      message: `${user.email} se connecte comme ${targetEmail} sur ${tenant.name}`,
      kind: "tenant.impersonate",
      priority: "normal",
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      action_url: `/king/tenants/${tenant.id}`,
      action_label: "Voir tenant",
      metadata: { target_user_id: targetUserId, target_email: targetEmail },
    }).catch(() => null);

    return new Response(JSON.stringify({
      ok: true,
      impersonate_url: impersonateUrl,
      target_email: targetEmail,
      tenant_name: tenant.name,
      tenant_slug: tenant.slug,
      message: "Ouvre cette URL dans une fenêtre privée pour ne pas écraser ta session King.",
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    log.error("Unexpected error", { err: (err as any)?.message });
    return new Response(JSON.stringify({ error: "Internal error", details: (err as any)?.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
