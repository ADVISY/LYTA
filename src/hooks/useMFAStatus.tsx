/**
 * useMFAStatus — État MFA de l'utilisateur connecté + décision d'enforcement.
 *
 * Combine 3 sources de vérité :
 *   1. `useUserRole()` → est-ce que l'user est admin ou king ? (cible enforcement)
 *   2. `supabase.auth.mfa.listFactors()` → l'user a-t-il un facteur TOTP "verified" ?
 *   3. `profiles.mfa_required_since` → quand a-t-on commencé le compte à rebours ?
 *
 * Retourne :
 *   - `hasTotpFactor`     : true si au moins 1 facteur TOTP "verified" enrôlé
 *   - `isMfaRequired`     : true si l'user a un rôle admin/king (cible enforcement)
 *   - `gracePeriodEndsAt` : Date | null — fin du sursis 7j (null si pas de
 *     `mfa_required_since` ou MFA déjà fait)
 *   - `daysRemaining`     : nombre entier de jours restants (peut être négatif)
 *   - `isInGracePeriod`   : true si requis + pas de facteur + dans les 7j
 *   - `isBlocked`         : true si requis + pas de facteur + après les 7j
 *   - `loading`           : chargement en cours
 *   - `refresh()`         : recharge les factors (utile après enrollment success)
 *
 * Side-effect important : si l'user est admin/king et n'a pas de TOTP et
 * `mfa_required_since IS NULL` côté profiles, on pose `now()` automatiquement
 * (1re détection = T0). C'est fait dans un effet, idempotent.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

const GRACE_PERIOD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface MFAStatus {
  hasTotpFactor: boolean;
  isMfaRequired: boolean;
  gracePeriodEndsAt: Date | null;
  daysRemaining: number;
  isInGracePeriod: boolean;
  isBlocked: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useMFAStatus(): MFAStatus {
  const { user } = useAuth();
  const { isKing, isAdmin, loading: rolesLoading } = useUserRole();

  const [hasTotpFactor, setHasTotpFactor] = useState(false);
  const [requiredSince, setRequiredSince] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const isMfaRequired = !!user && (isKing || isAdmin);

  // Charge factors + profile.mfa_required_since en parallèle
  const load = useCallback(async () => {
    if (!user?.id) {
      setHasTotpFactor(false);
      setRequiredSince(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [factorsRes, profileRes] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        (supabase as any)
          .from("profiles")
          .select("mfa_required_since")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      // 1. Facteurs TOTP "verified" (Supabase peut renvoyer des unverified
      //    si l'user a démarré un enroll mais ne l'a jamais terminé — on ignore)
      const totp = factorsRes.data?.totp ?? [];
      const verified = totp.find((f) => f.status === "verified");
      setHasTotpFactor(!!verified);

      // 2. Timestamp T0 du grace period (peut être null)
      const ts = profileRes.data?.mfa_required_since;
      setRequiredSince(ts ? new Date(ts) : null);
    } catch (err) {
      console.error("[useMFAStatus] load failed:", err);
      // En cas d'erreur, on assume "pas de factor" pour ne pas faussement
      // accorder un accès. C'est conservateur = côté sécu.
      setHasTotpFactor(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!rolesLoading) load();
  }, [load, rolesLoading]);

  // Side-effect : si admin/king sans TOTP et sans T0 → on pose `now()` côté DB.
  // Idempotent (une fois posé, on ne touche plus). Permet de démarrer la
  // grace period à la 1re détection plutôt qu'à la création du compte
  // (rétroactif fair pour les admins existants).
  useEffect(() => {
    if (loading || !user?.id || !isMfaRequired) return;
    if (hasTotpFactor) return; // l'user a fait son devoir, RAS
    if (requiredSince) return; // déjà posé
    // Pose T0
    (async () => {
      try {
        const now = new Date();
        const { error } = await (supabase as any)
          .from("profiles")
          .update({ mfa_required_since: now.toISOString() })
          .eq("id", user.id);
        if (error) {
          console.error("[useMFAStatus] failed to set mfa_required_since:", error);
        } else {
          setRequiredSince(now);
        }
      } catch (err) {
        console.error("[useMFAStatus] T0 update threw:", err);
      }
    })();
  }, [loading, user?.id, isMfaRequired, hasTotpFactor, requiredSince]);

  // Calculs dérivés
  const gracePeriodEndsAt =
    isMfaRequired && !hasTotpFactor && requiredSince
      ? new Date(requiredSince.getTime() + GRACE_PERIOD_DAYS * MS_PER_DAY)
      : null;

  const daysRemaining = gracePeriodEndsAt
    ? Math.ceil((gracePeriodEndsAt.getTime() - Date.now()) / MS_PER_DAY)
    : 0;

  const isInGracePeriod =
    isMfaRequired && !hasTotpFactor && !!gracePeriodEndsAt && Date.now() < gracePeriodEndsAt.getTime();

  const isBlocked =
    isMfaRequired && !hasTotpFactor && !!gracePeriodEndsAt && Date.now() >= gracePeriodEndsAt.getTime();

  return {
    hasTotpFactor,
    isMfaRequired,
    gracePeriodEndsAt,
    daysRemaining,
    isInGracePeriod,
    isBlocked,
    loading,
    refresh: load,
  };
}
