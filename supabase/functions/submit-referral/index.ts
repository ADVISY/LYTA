// Edge Function : submit-referral
// -----------------------------------------------------------------------------
// Soumission d'une recommandation depuis l'espace client.
//
// Workflow :
//   1. Le client connecté soumet le formulaire (prénom, nom, téléphone,
//      relation, message optionnel).
//   2. On vérifie son auth via Bearer token Supabase.
//   3. On récupère la fiche du client référent (clients où user_id = auth.uid()).
//   4. On crée un nouveau prospect dans `clients` avec :
//        - tenant_id et assigned_agent_id du référent
//        - status = 'prospect'
//        - type_adresse = 'client'
//        - external_ref = 'referral:<client_id du référent>'
//        - tags incluant 'Recommandation', 'Recommandé par <nom>',
//          'Relation: <type>', et 'Importé le <date>'
//   5. On notifie l'agent assigné, son manager (si défini) et tous les
//      admins/backoffice du tenant via insert direct dans `notifications`.
//      (NB: la fonction PL/pgSQL dispatch_staff_notification créée dans la
//       migration 20260427120000 sera utilisée par les triggers SQL ; ici on
//       reproduit la même logique côté Edge Function pour rester autonome.)
//
// Sécurité :
//   - L'auth Bearer est obligatoire.
//   - Le tenant et l'agent assigné sont déduits SERVEUR-CÔTÉ depuis la fiche
//     du client référent. Le client n'a aucun moyen d'injecter un autre
//     tenant_id ou un autre agent.
//   - L'INSERT côté `clients` se fait avec service_role car les RLS
//     interdisent (à juste titre) à un client final d'insérer dans `clients`.
// -----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";

interface ReferralPayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string | null;
  relation?: string;
  message?: string | null;
}

const ALLOWED_RELATIONS = [
  "ami",
  "famille",
  "frere",
  "soeur",
  "parent",
  "conjoint",
  "collegue",
  "voisin",
  "autre",
];

function jsonResponse(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function sanitize(value: unknown, max = 200): string {
  if (value == null) return "";
  return String(value).trim().slice(0, max);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  try {
    const { user } = await requireAuth(req);

    const body = (await req.json().catch(() => ({}))) as ReferralPayload;

    const first_name = sanitize(body.first_name, 80);
    const last_name = sanitize(body.last_name, 80);
    const phone = sanitize(body.phone, 30);
    const emailRaw = sanitize(body.email, 200).toLowerCase();
    const relation = sanitize(body.relation, 30).toLowerCase();
    const message = sanitize(body.message, 1000);

    if (!first_name || !last_name) {
      return jsonResponse(req, 400, { error: "Le prénom et le nom sont obligatoires." });
    }
    if (!phone) {
      return jsonResponse(req, 400, { error: "Le téléphone est obligatoire." });
    }

    const email = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;
    const relationFinal = ALLOWED_RELATIONS.includes(relation) ? relation : "autre";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Récupérer la fiche du client référent
    const { data: referrer, error: referrerError } = await admin
      .from("clients")
      .select("id, tenant_id, assigned_agent_id, first_name, last_name, company_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (referrerError) {
      console.error("[submit-referral] referrer lookup error", referrerError);
      return jsonResponse(req, 500, { error: "Erreur lors de la récupération de votre fiche." });
    }
    if (!referrer || !referrer.tenant_id) {
      return jsonResponse(req, 403, { error: "Aucune fiche client n'est associée à votre compte." });
    }

    const referrerName =
      referrer.company_name?.trim() ||
      `${referrer.first_name ?? ""} ${referrer.last_name ?? ""}`.trim() ||
      "Un client";

    const today = new Date();
    const todayLabel = today.toLocaleDateString("fr-CH");

    const tags = [
      "Recommandation",
      `Recommandé par ${referrerName}`,
      `Relation: ${relationFinal}`,
      `Reçue le ${todayLabel}`,
    ];

    const newProspect: Record<string, unknown> = {
      tenant_id: referrer.tenant_id,
      assigned_agent_id: referrer.assigned_agent_id ?? null,
      type_adresse: "client",
      status: "prospect",
      first_name,
      last_name,
      phone,
      mobile: phone,
      email,
      tags,
      external_ref: `referral:${referrer.id}`,
      is_company: false,
    };

    const { data: created, error: insertError } = await admin
      .from("clients")
      .insert(newProspect)
      .select("id")
      .single();

    if (insertError || !created) {
      console.error("[submit-referral] insert error", insertError);
      return jsonResponse(req, 500, { error: "Impossible d'enregistrer la recommandation." });
    }

    // Construction des destinataires staff
    const recipients = new Set<string>();

    // Admins + backoffice du tenant
    const { data: staff } = await admin
      .from("user_tenant_assignments")
      .select("user_id, user_roles:user_roles!inner(role)")
      .eq("tenant_id", referrer.tenant_id);

    if (Array.isArray(staff)) {
      for (const row of staff as Array<{ user_id: string; user_roles?: Array<{ role: string }> | { role: string } }>) {
        const roles = Array.isArray(row.user_roles) ? row.user_roles : row.user_roles ? [row.user_roles] : [];
        if (roles.some((r) => r.role === "admin" || r.role === "backoffice")) {
          recipients.add(row.user_id);
        }
      }
    }

    // Agent assigné
    if (referrer.assigned_agent_id) {
      const { data: agent } = await admin
        .from("clients")
        .select("user_id, manager_id")
        .eq("id", referrer.assigned_agent_id)
        .maybeSingle();

      if (agent?.user_id) recipients.add(agent.user_id);

      if (agent?.manager_id) {
        const { data: manager } = await admin
          .from("clients")
          .select("user_id")
          .eq("id", agent.manager_id)
          .maybeSingle();
        if (manager?.user_id) recipients.add(manager.user_id);
      }
    }

    // Insertion des notifications (1 par destinataire)
    if (recipients.size > 0) {
      const title = "Nouvelle recommandation";
      const messageText = `${referrerName} recommande ${first_name} ${last_name} (${relationFinal})`;
      const action_url = `/crm/clients/${created.id}`;
      const payload: Record<string, unknown> = {
        event: "new_referral",
        referrer_client_id: referrer.id,
        prospect_client_id: created.id,
        relation: relationFinal,
      };
      if (message) payload.note = message;

      const notifs = Array.from(recipients).map((uid) => ({
        user_id: uid,
        tenant_id: referrer.tenant_id,
        kind: "info",
        title,
        message: messageText,
        priority: "normal",
        action_url,
        payload,
      }));

      const { error: notifError } = await admin.from("notifications").insert(notifs);
      if (notifError) {
        console.error("[submit-referral] notification insert error", notifError);
        // on n'échoue pas la requête : la recommandation est créée, c'est l'essentiel
      }
    }

    return jsonResponse(req, 200, {
      success: true,
      prospect_id: created.id,
      notified_count: recipients.size,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return jsonResponse(req, e.status, { error: e.message });
    }
    console.error("[submit-referral] unexpected error", e);
    return jsonResponse(req, 500, { error: "Erreur interne." });
  }
});
