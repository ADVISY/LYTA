/**
 * storage — Helpers Supabase Storage centralisés.
 *
 * Pourquoi : avant, la même paire (createSignedUrl + gestion d'erreur +
 * fallback) était dupliquée dans 4 fichiers :
 *   - ClientDocuments.tsx  (téléchargement + view)
 *   - ClientContracts.tsx  (view)
 *   - ClientClaims.tsx     (download)
 *   - ClientDetail.tsx     (view legacy handleDocumentView)
 *   - DocumentPreviewDialog.tsx (inline preview)
 *
 * Résultat : gestion d'erreur incohérente entre écrans, TTL différent
 * selon l'endroit, aucun cache. Un client qui passe d'un onglet à l'autre
 * regénérait des signed URLs à chaque fois pour le MÊME document.
 *
 * Ce helper unifie tout :
 *   - `getSignedDocumentUrl(fileKey, ttl?)` : renvoie l'URL signée avec
 *     un cache Map en mémoire (invalidé à TTL/2 pour éviter des URLs
 *     déjà expirées côté navigateur)
 *   - `triggerDownload(url, filename)` : force le download via <a download>
 *     au lieu d'ouvrir un nouvel onglet (comportement plus prévisible
 *     pour le user)
 */
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_BUCKET = "documents";
const DEFAULT_TTL_SECONDS = 3600; // 1h
// Renewal safety : on considère une URL "expirée" à TTL/2 pour laisser
// le temps au user de cliquer / au fetch de partir avant l'expiration réelle.
const RENEWAL_MARGIN_RATIO = 0.5;

interface CachedUrl {
  url: string;
  expiresAt: number; // ms timestamp
}

const urlCache = new Map<string, CachedUrl>();

function cacheKey(bucket: string, fileKey: string): string {
  return `${bucket}::${fileKey}`;
}

/**
 * Génère (ou renvoie depuis cache) une signed URL pour un document Supabase
 * Storage. Le cache est invalidé quand l'URL approche de son expiration
 * (à TTL/2 par défaut).
 *
 * @throws Error si la génération échoue. Le call site est responsable
 *         d'afficher un toast approprié.
 */
export async function getSignedDocumentUrl(
  fileKey: string,
  options?: { ttlSeconds?: number; bucket?: string; forceRefresh?: boolean },
): Promise<string> {
  const ttl = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const bucket = options?.bucket ?? DEFAULT_BUCKET;
  const key = cacheKey(bucket, fileKey);

  // Cache hit ?
  if (!options?.forceRefresh) {
    const cached = urlCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(fileKey, ttl);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Signed URL vide");

  urlCache.set(key, {
    url: data.signedUrl,
    // Considère l'URL "fraîche" pendant TTL * RENEWAL_MARGIN_RATIO
    expiresAt: Date.now() + ttl * 1000 * RENEWAL_MARGIN_RATIO,
  });

  return data.signedUrl;
}

/**
 * Force le téléchargement d'un fichier via une balise <a download>.
 * Plus fiable que window.open (pas de popup blocker, meilleure UX mobile).
 * Le browser choisit le comportement selon le mime type et les headers
 * Content-Disposition renvoyés par Supabase.
 */
export function triggerDownload(url: string, filename?: string): void {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Purge le cache — utile si on sait qu'un doc a été renommé/replacé. */
export function clearSignedUrlCache(fileKey?: string, bucket: string = DEFAULT_BUCKET): void {
  if (!fileKey) {
    urlCache.clear();
    return;
  }
  urlCache.delete(cacheKey(bucket, fileKey));
}
