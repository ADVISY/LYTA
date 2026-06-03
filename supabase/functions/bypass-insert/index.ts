/**
 * bypass-insert
 * =============
 * Edge function générique pour INSERT sur des tables protégées par RLS qui
 * plantent en runtime PostgREST (code 42501) malgré des conditions WITH CHECK
 * qui semblent satisfaites en test SQL.
 *
 * Cause systémique observée chez Advisy et JCG, sur plusieurs tables :
 *   - clients (résolu via create-client)
 *   - policies (résolu via save-policy)
 *   - family_members + documents (utilisés par Smartflow)
 *
 * Plutôt que de créer une edge function par table, on whitelist les tables
 * autorisées et on fait l'INSERT via service_role après vérif que le caller
 * est membre du tenant cible. Pas d'escalation possible — un Agent ne peut
 * pas insérer pour un tenant dont il n'est pas membre.
 *
 * Whitelist actuelle :
 *   - family_members : pas de tenant_id (lien via client_id qu'on vérifie)
 *   - documents      : champ tenant_id requis dans le payload
 *
 * Pour clients/policies, utiliser les fonctions dédiées create-client /
 * save-policy qui font des validations métier additionnelles.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("bypass-insert");

const ALLOWED_TABLES = new Set([
  "family_members",
  "documents",
]);

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

interface BypassInsertRequest {
  table?: string;
  payload?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user } = await requireAuth(req);

    let body: BypassInsertRequest;
    try {
      body = await req.json();
    } catch {
      return json(req, { error: "Corps de la requête invalide (JSON attendu)" }, 400);
    }

    const table = body.table;
    const payload = body.payload;

    if (!table || !ALLOWED_TABLES.has(table)) {
      return json(req, { error: `Table non autorisée : ${table}` }, 400);
    }

    if (!payload || typeof payload !== "object") {
      return json(req, { error: "payload requis (object)" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ─── Sécurité : vérif que le caller est membre du tenant cible ───
    // Pour les tables qui ont un tenant_id, on le récupère du payload.
    // Pour family_members (pas de tenant_id direct), on déduit via client_id.
    let tenantId: string | null = null;

    if (typeof payload.tenant_id === "string") {
      tenantId = payload.tenant_id;
    } else if (table === "family_members" && typeof payload.client_id === "string") {
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("tenant_id")
        .eq("id", payload.client_id)
        .maybeSingle();
      tenantId = (client?.tenant_id as string) ?? null;
    }

    if (!tenantId) {
      return json(req, { error: "Impossible de déterminer le tenant cible" }, 400);
    }

    // Vérif membership : user_tenant_assignments OU rôle global admin/king
    const { data: assignment } = await supabaseAdmin
      .from("user_tenant_assignments")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!assignment) {
      const { data: globalRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isGlobalAdmin = (globalRoles ?? []).some(
        (r) => r.role === "admin" || r.role === "king",
      );

      if (!isGlobalAdmin) {
        throw new AuthError("Vous n'êtes pas membre du cabinet cible", 403);
      }
    }

    // ─── INSERT via service_role (bypass RLS clean) ───
    const newId = crypto.randomUUID();
    const finalPayload = { ...payload, id: newId };

    const { error: insertError } = await supabaseAdmin
      .from(table)
      .insert(finalPayload);

    if (insertError) {
      log.error("Failed to insert", {
        table,
        code: (insertError as any).code,
        message: insertError.message,
        details: (insertError as any).details,
        hint: (insertError as any).hint,
        tenantId,
        userId: user.id,
      });
      return json(
        req,
        {
          error: "Erreur lors de l'INSERT",
          details: insertError.message,
          code: (insertError as any).code,
        },
        500,
      );
    }

    log.info("bypass-insert ok", { table, id: newId, tenantId, userId: user.id });
    return json(req, { success: true, id: newId, data: finalPayload }, 200);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    log.error("Unhandled error", { error: message });
    return json(req, { error: message }, status);
  }
});
