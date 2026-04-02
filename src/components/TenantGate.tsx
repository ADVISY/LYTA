import { useTenant } from "@/contexts/TenantContext";
import { Building2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TenantGateProps {
  children: React.ReactNode;
  requireTenant?: boolean;
}

/**
 * Gate component that checks for valid tenant context
 * - If requireTenant=true, shows error if no tenant found
 * - If requireTenant=false, allows access without tenant (for main platform)
 */
export function TenantGate({ children, requireTenant = false }: TenantGateProps) {
  const { tenant, isLoading, error } = useTenant();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="p-4 bg-destructive/10 rounded-full w-fit mx-auto mb-6">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Accès impossible</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/'}
          >
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  // If tenant is required but not found
  if (requireTenant && !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="p-4 bg-muted rounded-full w-fit mx-auto mb-6">
            <Building2 className="h-12 w-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Cabinet non identifié</h1>
          <p className="text-muted-foreground mb-6">
            Accédez à votre espace via l'URL de votre cabinet (ex: votrecabinet.lyta.ch)
          </p>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/connexion'}
          >
            Se connecter
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
