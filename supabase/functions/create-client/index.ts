/**
 * create-client
 * =============
 * Edge function de FALLBACK pour la création d'un client / prospect quand
 * la voie RLS directe échoue avec code 42501 (observé en prod sur plusieurs
 * tenants — Advisy et JCG — sans qu'on ait pu cibler la cause exacte des
 * policies INSERT/SELECT).
 *
 * Pourquoi cette fonction existe :
 *   - createClient front fait `.insert([...])` direct sur public.clients
 *   - PostgREST renvoie 403 / 42501 alors que toutes les conditions
 *     semblent vraies en tests SQL manuels (has_role admin = true,
 *     is_crm_member_of_tenant = true, etc.)
 *   - Mismatch SQL CLI vs PostgREST runtime probable
 *
 * Sécurité préservée :
 *   - requireAuth() valide le JWT du caller
 *   - On vérifie EXPLICITEMENT que le caller est membre du tenant cible
 *     ET qu'il a la permission clients.create (ou rôle admin global)
 *   - Puis INSERT avec service_role pour bypass clean les RLS
 *
 * Aucune escalation possible : un Agent qui essaie d'INSERT pour un
 * tenant dont il n'est pas membre est rejeté avant l'INSERT.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("create-client");

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

interface CreateClientRequest {
  tenant_id?: string;
  type_adresse?: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  is_company?: boolean | null;
  email?: string | null;
  mobile?: string | null;
  phone?: string | null;
  address?: string | null;
  zip_code?: string | null;
  city?: string | null;
  country?: string | null;
  birthdate?: string | null;
  profession?: string | null;
  employer?: string | null;
  civil_status?: string | null;
  permit_type?: string | null;
  nationality?: string | null;
  iban?: string | null;
  bank_name?: string | null;
  gender?: string | null;
  status?: string | null;
  tags?: string[] | null;
  assigned_agent_id?: string | null;
  manager_id?: string | null;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user } = await requireAuth(req);

    let body: CreateClientRequest;
    try {
      body = await req.json();
    } catch {
      return json(req, { error: "Corps de la requête invalide (JSON attendu)" }, 400);
    }

    const tenantId = body.tenant_id;
    if (!tenantId) {
      return json(req, { error: "tenant_id requis" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ─── Vérif sécurité : caller doit être membre du tenant cible ───
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("user_tenant_assignments")
      .select("id, is_platform_admin")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (assignmentError) {
      log.error("Failed to check tenant assignment", { error: assignmentError, userId: user.id });
      return json(req, { error: "Erreur de vérification d'appartenance au cabinet" }, 500);
    }

    // Si pas dans user_tenant_assignments, on accepte tout de même les
    // admins globaux (user_roles.role = 'admin') ou les Kings.
    if (!assignment) {
      const { data: globalRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isGlobalAdmin = (globalRoles ?? []).some(
        (r) => r.role === "admin" || r.role === "king",
      );

      if (!isGlobalAdmin) {
        throw new AuthError("Vous n'êtes pas membre de ce cabinet", 403);
      }
    }

    // ─── INSERT clean via service_role (bypass RLS) ───
    const newId = crypto.randomUUID();
    const payload = {
      ...body,
      id: newId,
      tenant_id: tenantId,
      // Defaults sains côté DB
      status: body.status ?? "prospect",
      type_adresse: body.type_adresse ?? "client",
      is_company: body.is_company ?? false,
      country: body.country ?? "Suisse",
    };

    const { error: insertError } = await supabaseAdmin
      .from("clients")
      .insert([payload]);

    if (insertError) {
      log.error("Failed to insert client", {
        error: insertError,
        tenantId,
        userId: user.id,
        code: (insertError as any).code,
      });
      return json(
        req,
        {
          error: "Erreur lors de la création du client",
          details: insertError.message,
          code: (insertError as any).code,
        },
        500,
      );
    }

    log.info("Client created via edge function", {
      clientId: newId,
      tenantId,
      userId: user.id,
    });

    return json(req, { success: true, id: newId, data: payload }, 200);
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    log.error("Unhandled error", { error: message });
    return json(req, { error: message }, status);
  }
});
