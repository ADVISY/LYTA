/**
 * MFAEnforcer — Wrap autour des routes /crm et /king.
 *
 * Décide ce qui se passe pour un utilisateur admin/king qui n'a PAS encore
 * enrôlé de facteur TOTP :
 *   - Pendant le grace period (7j depuis `profiles.mfa_required_since`) :
 *     affiche un banner non-dismissible en haut avec compte à rebours.
 *     L'app reste utilisable normalement (children rendus).
 *   - Après le grace period : hard redirect vers /setup-mfa, aucune autre
 *     page accessible.
 *
 * N'affecte PAS :
 *   - Les utilisateurs sans rôle admin/king (passent through)
 *   - L'espace client (`/espace-client`) — pas concerné
 *   - La page /setup-mfa elle-même (on n'enferme pas l'user dans une boucle)
 *
 * Robustesse :
 *   - Si `useMFAStatus()` est encore en `loading`, on ne fait rien (pas de
 *     flash de banner ou de redirect avant d'avoir les vraies données).
 *   - Si l'user n'est pas connecté, on ne s'occupe de rien — c'est
 *     `<ProtectedRoute>` qui gère.
 */
import { useEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMFAStatus } from "@/hooks/useMFAStatus";
import { Shield, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MFAEnforcerProps {
  children: ReactNode;
}

export function MFAEnforcer({ children }: MFAEnforcerProps) {
  const { user } = useAuth();
  const { isMfaRequired, hasTotpFactor, isInGracePeriod, isBlocked, daysRemaining, loading } =
    useMFAStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const onSetupPage = location.pathname.startsWith("/setup-mfa");

  // Hard redirect vers /setup-mfa si l'user est bloqué et qu'il n'y est pas déjà
  useEffect(() => {
    if (loading || !user) return;
    if (isBlocked && !onSetupPage) {
      navigate("/setup-mfa", { replace: true });
    }
  }, [loading, user, isBlocked, onSetupPage, navigate]);

  // Cas où on laisse passer sans rien afficher :
  //   - pas d'user (géré par ProtectedRoute)
  //   - data en train de charger (évite flash banner)
  //   - user pas concerné (pas admin/king OU MFA déjà enrôlé)
  //   - déjà sur /setup-mfa (sinon on overlay un banner par-dessus la page)
  if (!user || loading || !isMfaRequired || hasTotpFactor || onSetupPage) {
    return <>{children}</>;
  }

  // Hors grace → on est en train de rediriger, render rien
  if (isBlocked) return null;

  // En grace period → banner + children
  if (isInGracePeriod) {
    const urgency =
      daysRemaining <= 2
        ? "bg-destructive text-destructive-foreground"
        : daysRemaining <= 4
          ? "bg-amber-500 text-white"
          : "bg-primary text-primary-foreground";

    return (
      <div className="flex flex-col min-h-screen">
        <div
          className={`${urgency} px-4 py-2 flex items-center justify-between gap-3 text-sm flex-wrap`}
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {daysRemaining <= 2 ? (
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Shield className="h-4 w-4 flex-shrink-0" />
            )}
            <span className="font-medium">
              Activez la double authentification —{" "}
              {daysRemaining > 0
                ? `${daysRemaining} jour${daysRemaining > 1 ? "s" : ""} restant${daysRemaining > 1 ? "s" : ""}`
                : "aujourd'hui"}
            </span>
            <span className="hidden sm:inline opacity-80">
              · Obligatoire pour les comptes administrateur
            </span>
          </div>
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="gap-1.5 h-7"
          >
            <Link to="/setup-mfa">
              Activer maintenant
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  // Filet de sécurité : si on arrive ici, c'est qu'on est requis et sans
  // factor mais ni "in grace" ni "blocked". Concrètement : `requiredSince`
  // est encore NULL le temps que le side-effect du hook le pose. On laisse
  // passer le rendu — le banner apparaîtra au prochain re-render.
  return <>{children}</>;
}
