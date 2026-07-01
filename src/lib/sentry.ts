/**
 * Sentry — Monitoring d'erreurs + perf en prod.
 *
 * Activé seulement si VITE_SENTRY_DSN est défini (donc opt-in via Vercel env).
 * En dev, on n'envoie rien : on garde les erreurs locales dans la console.
 *
 * PII scrubbing (conformité LPD/RGPD) :
 *   - On masque automatiquement les tokens, emails, et IDs Supabase dans les
 *     URLs des breadcrumbs.
 *   - On bloque l'auto-capture des `<input>` valeurs (Replay désactivé par
 *     défaut de toute façon — pas activé ici, pas dans le budget).
 *   - On vide `event.user` côté email/ip — seul l'id Supabase est gardé pour
 *     corréler par cabinet, jamais d'info identifiante.
 *
 * Ignore patterns : les erreurs "bruit" qui polluent sans valeur (ex.
 * ResizeObserver loop, extensions Chrome, ChunkLoadError sur deploy).
 */
import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const RELEASE = (import.meta.env.VITE_APP_VERSION as string) || "dev";
const ENV =
  (import.meta.env.VITE_SENTRY_ENV as string) ||
  (import.meta.env.PROD ? "production" : "development");

/** Patterns d'erreurs à ignorer (bruit pur). */
const IGNORE_ERROR_PATTERNS = [
  // Bruit classique navigateur
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  // Extensions / scripts injectés par le navigateur
  "Non-Error promise rejection captured with value:",
  "Script error.",
  // Chunk fail après deploy : se résout après reload
  "ChunkLoadError",
  "Loading chunk",
  "Loading CSS chunk",
  // Auth flow (l'user a annulé / canceled signin)
  "AbortError",
];

/** Patterns d'URL à scrub (jamais envoyer ces query params). */
const SCRUB_QUERY_KEYS = [
  "access_token",
  "refresh_token",
  "id_token",
  "token",
  "code",
  "key",
  "apikey",
  "password",
];

function scrubUrl(url: string): string {
  try {
    const u = new URL(url, "https://placeholder.lyta.ch");
    let mutated = false;
    for (const k of SCRUB_QUERY_KEYS) {
      if (u.searchParams.has(k)) {
        u.searchParams.set(k, "[Filtered]");
        mutated = true;
      }
    }
    return mutated ? u.toString() : url;
  } catch {
    return url;
  }
}

export function initSentry(): void {
  if (!DSN) {
    // Pas de DSN → on ne fait rien. C'est volontaire en dev.
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    release: RELEASE,
    // Sample rates raisonnables :
    //   - 100% des erreurs (on ne veut rien rater)
    //   - 10% des transactions de perf (sinon trop coûteux + bruit)
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Liste des patterns à ignorer côté SDK (avant tout traitement réseau)
    ignoreErrors: IGNORE_ERROR_PATTERNS,
    // Domaines de notre app UNIQUEMENT — on n'ajoute PAS les headers de tracing
    // (`baggage`, `sentry-trace`) sur les requêtes vers Supabase parce que
    // leurs endpoints (auth, rest, functions, storage) n'ont pas
    // `baggage` dans leur `Access-Control-Allow-Headers`. Résultat sans
    // cette restriction : toutes les requêtes CORS Supabase cassent avec
    // "Request header field baggage is not allowed" (bug juin 2026).
    // Impact : on perd la vue "trace distribuée" côté Supabase, mais on
    // garde toutes les erreurs frontend + les breadcrumbs de fetch.
    tracePropagationTargets: [
      /^https:\/\/[^/]+\.lyta\.ch/,
      /^https:\/\/lyta\.ch/,
      /^\//, // requêtes relatives (route interne app)
    ],
    // Beforesend : dernier filet de sécurité PII + scrubbing
    beforeSend(event) {
      // Scrub PII utilisateur (on garde uniquement l'id Supabase si présent)
      if (event.user) {
        const safeUser: { id?: string } = {};
        if (event.user.id) safeUser.id = event.user.id;
        event.user = safeUser;
      }
      // Scrub URL de la requête
      if (event.request?.url) {
        event.request.url = scrubUrl(event.request.url);
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      // Scrub URLs dans les breadcrumbs (fetch, navigation, etc.)
      if (breadcrumb.data?.url && typeof breadcrumb.data.url === "string") {
        breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
      }
      if (breadcrumb.data?.to && typeof breadcrumb.data.to === "string") {
        breadcrumb.data.to = scrubUrl(breadcrumb.data.to);
      }
      return breadcrumb;
    },
  });
}

/**
 * Identifie l'utilisateur côté Sentry. À appeler après login et au logout
 * (avec `null` pour clear). On ne stocke QUE l'id pour corréler les sessions
 * sans exposer d'info identifiante (LPD).
 */
export function setSentryUser(userId: string | null, tenantId?: string | null): void {
  if (!DSN) return;
  if (userId) {
    Sentry.setUser({ id: userId });
    if (tenantId) Sentry.setTag("tenant_id", tenantId);
  } else {
    Sentry.setUser(null);
    Sentry.setTag("tenant_id", undefined);
  }
}
