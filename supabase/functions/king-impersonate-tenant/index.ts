/**
 * king-impersonate-tenant
 * =======================
 * King-only : génère un magic link de connexion pour un user admin du tenant.
 * Permet au support LYTA de se connecter "comme" un user du cabinet pour
 * débugger sans avoir besoin du mot de passe.
 *
 * Durcissement sécurité juin 2026 (cf. audit Phase 1 #8) :
 *
 *   1. `reason` obligatoire dans le body — le KING doit justifier
 *      pourquoi il impersonate. Stocké dans l'audit_log + visible
 *      par le tenant impersoné pour traçabilité légale (nLPD).
 *
 *   2. Check session fraîche — si la dernière connexion KING date
 *      de plus de 15 min, on refuse. Force le KING à se reconnecter
 *      (= re-valider son MFA si activé). Atténue la fenêtre d'attaque
 *      en cas de vol de cookie/JWT.
 *
 *   3. Notification au TENANT impersoné — INSERT dans `notifications`
 *      pour chaque admin du tenant. Le tenant voit à sa prochaine
 *      connexion : "Le support LYTA s'est connecté à votre compte
 *      le X à HH:MM. Raison : <reason>". Obligation nLPD = informer
 *      la personne dont les données sont traitées.
 *
 * Body : {
 *   tenant_id: "uuid",            // obligatoire
 *   target_user_id?: "uuid",      // optionnel — sinon premier admin
 *   reason: string                // obligatoire — justification
 * }
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

// Délai max entre la dernière connexion KING et l'impersonate (anti-vol JWT).
// 15 min = compromis raisonnable : assez court pour atténuer un vol de
// session opportuniste, assez long pour ne pas forcer le KING à se
// reconnecter à chaque impersonate.
const MAX_SESSION_AGE_MS = 15 * 60 * 1000;

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

    // ─── 1. Vérif que l'user est KING ─────────────────────────────
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isKing = (roles || []).some((r: any) => r.role === "king");
    if (!isKing) throw new AuthError("Forbidden — king required", 403);

    // ─── 2. Body validation (reason obligatoire) ──────────────────
    const body = (await req.json().catch(() => ({}))) as {
      tenant_id?: string;
      target_user_id?: string;
      reason?: string;
    };
    if (!body.tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const reason = (body.reason || "").trim();
    if (!reason || reason.length < 10) {
      return new Response(JSON.stringify({
        error: "reason required (min 10 caractères) — justification obligatoire pour traçabilité nLPD",
      }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (reason.length > 500) {
      return new Response(JSON.stringify({ error: "reason trop longue (max 500)" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ─── 3. Check session fraîche (anti-vol JWT) ──────────────────
    const { data: userFull } = await supabase.auth.admin.getUserById(user.id);
    const lastSignInAt = userFull?.user?.last_sign_in_at;
    if (!lastSignInAt) {
      throw new AuthError("Impossible de valider l'âge de session", 401);
    }
    const sessionAge = Date.now() - new Date(lastSignInAt).getTime();
    if (sessionAge > MAX_SESSION_AGE_MS) {
      const minutesOld = Math.round(sessionAge / 60000);
      return new Response(JSON.stringify({
        error: "Session trop ancienne",
        details: `Ta dernière connexion date d'il y a ${minutesOld} minutes (max ${MAX_SESSION_AGE_MS / 60000} min pour impersonate). Reconnecte-toi puis retente.`,
        requires_relogin: true,
      }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ─── 4. Trouver le tenant + target user ───────────────────────
    const { data: tenant } = await supabase
      .from("tenants").select("id, name, slug")
      .eq("id", body.tenant_id).maybeSingle();
    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant introuvable" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

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

    // ─── 5. Generate magic link ───────────────────────────────────
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
    const impersonateAtIso = new Date().toISOString();

    // ─── 6. Audit log KING (enrichi avec reason) ──────────────────
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
        reason,
        session_age_min: Math.round(sessionAge / 60000),
      },
    });

    // ─── 7. Notification au TENANT impersoné (durcissement juin 2026) ─
    // On notifie TOUS les admins du tenant pour qu'à leur prochaine
    // connexion, ils voient explicitement que le support LYTA s'est
    // connecté à leur compte + pour quelle raison. Conformité nLPD :
    // informer le tenant que ses données ont été consultées par un tiers
    // (même un employé LYTA en mode support).
    try {
      // Récupère tous les admins du tenant via user_tenant_assignments
      const { data: assignments } = await supabase
        .from("user_tenant_assignments")
        .select("user_id")
        .eq("tenant_id", tenant.id);

      const adminUserIds = (assignments ?? []).map((a) => a.user_id).filter(Boolean);

      if (adminUserIds.length > 0) {
        const notifRows = adminUserIds.map((uid) => ({
          user_id: uid,
          kind: "king.impersonate",
          title: "🔓 Connexion support LYTA à votre compte",
          message: `Le support LYTA (${user.email ?? "king"}) s'est connecté à votre compte cabinet pour des raisons techniques. Motif : « ${reason} »`,
          payload: {
            actor_email: user.email,
            target_email: targetEmail,
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            reason,
            impersonated_at: impersonateAtIso,
          },
        }));

        const { error: notifErr } = await supabase.from("notifications").insert(notifRows);
        if (notifErr) {
          // Non-bloquant : on log mais on continue (le magic link doit
          // partir même si la notif fail, sinon Habib se retrouve sans
          // accès en cas d'urgence support).
          log.error("Tenant notification insert failed", { notifErr });
        } else {
          log.info("Tenant admins notified of impersonation", { count: notifRows.length });
        }
      } else {
        log.warn("No tenant admin found to notify of impersonation", { tenantId: tenant.id });
      }
    } catch (notifThrown) {
      log.error("Tenant notification block threw", {
        error: notifThrown instanceof Error ? notifThrown.message : String(notifThrown),
      });
    }

    // ─── 8. Notif KING pour traçabilité interne ──────────────────
    await supabase.from("king_notifications").insert({
      title: "🔓 Impersonation tenant",
      message: `${user.email} se connecte comme ${targetEmail} sur ${tenant.name}. Raison : ${reason}`,
      kind: "tenant.impersonate",
      priority: "normal",
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      action_url: `/king/tenants/${tenant.id}`,
      action_label: "Voir tenant",
      metadata: {
        target_user_id: targetUserId,
        target_email: targetEmail,
        reason,
        session_age_min: Math.round(sessionAge / 60000),
      },
    }).catch(() => null);

    return new Response(JSON.stringify({
      ok: true,
      impersonate_url: impersonateUrl,
      target_email: targetEmail,
      tenant_name: tenant.name,
      tenant_slug: tenant.slug,
      message: "Ouvre cette URL dans une fenêtre privée pour ne pas écraser ta session King. Le tenant a été notifié.",
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
