/**
 * resend-signup-finalization
 * ==========================
 * King-only : envoie un email "Termine ton inscription" à un broker qui a
 * payé sur Stripe mais n'a pas finalisé le form /access (pending_signup
 * orphelin). Le mail contient le lien direct vers /access?session_id=...
 *
 * Body : { pending_signup_id: "uuid" }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("resend-signup-finalization");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
// La page /finalize vit sur app.lyta.ch (ce repo), plus sur lyta.ch (Lovable)
const APP_BASE = Deno.env.get("PUBLIC_APP_URL") || "https://app.lyta.ch";

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
    const isKing = (roles || []).some((r: any) => r.role === "king" || r.role === "admin");
    if (!isKing) throw new AuthError("Forbidden — king/admin required", 403);

    const body = (await req.json().catch(() => ({}))) as { pending_signup_id?: string };
    if (!body.pending_signup_id) {
      return new Response(JSON.stringify({ error: "pending_signup_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: pending } = await supabase
      .from("pending_signups")
      .select("*")
      .eq("id", body.pending_signup_id)
      .maybeSingle();
    if (!pending) {
      return new Response(JSON.stringify({ error: "Pending signup introuvable" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (pending.status === 'finalized') {
      return new Response(JSON.stringify({ error: "Déjà finalisé" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!pending.customer_email) {
      return new Response(JSON.stringify({ error: "Pas d'email customer sur cette session" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const finalizeUrl = `${APP_BASE.replace(/\/$/, "")}/finalize?session_id=${encodeURIComponent(pending.stripe_session_id)}`;

    const html = `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 24px;">
<div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px;">
  <h2 style="color: #1a1a2e; margin-top: 0;">Bienvenue chez LYTA 🎉</h2>
  <p>Ton paiement a bien été reçu, mais ton cabinet n'est pas encore créé !</p>
  <p>Il te reste juste à <strong>remplir 1 petit formulaire</strong> (nom du cabinet, slug, infos admin) pour qu'on te livre tes accès dans la foulée.</p>
  <p style="text-align: center; margin: 32px 0;">
    <a href="${finalizeUrl}"
       style="background: #1800AD; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
      Finaliser mon inscription
    </a>
  </p>
  <p style="color: #666; font-size: 13px; margin-top: 24px;">
    Lien direct : <a href="${finalizeUrl}" style="color: #1800AD;">${finalizeUrl}</a>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px;">
    Cet email a été envoyé suite à ton paiement sur lyta.ch (essai 7 jours, plan ${pending.plan_id || '—'}).
    Si tu n'as pas effectué ce paiement ou si tu veux annuler, contacte support@lyta.ch.
  </p>
</div></body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "LYTA <support@lyta.ch>",
        to: [pending.customer_email],
        subject: "Termine ton inscription LYTA — 1 minute",
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      log.error("Resend failed", { errText });
      return new Response(JSON.stringify({ error: "Send failed", details: errText }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Incrémenter reminder_count
    await supabase
      .from("pending_signups")
      .update({
        reminder_count: (pending.reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
      })
      .eq("id", pending.id);

    return new Response(JSON.stringify({
      ok: true,
      sent_to: pending.customer_email,
      finalize_url: finalizeUrl,
      reminder_count: (pending.reminder_count || 0) + 1,
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
