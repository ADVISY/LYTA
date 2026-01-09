import { ReactNode } from 'react';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { PlanModule, MODULE_DISPLAY_NAMES, PLAN_CONFIGS } from '@/config/plans';
import { Lock, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ModuleGateProps {
  /** Required module(s) - if array, ANY of them must be enabled */
  module: PlanModule | PlanModule[];
  /** Content to render if module is enabled */
  children: ReactNode;
  /** Fallback content (optional, default is upgrade prompt) */
  fallback?: ReactNode;
  /** If true, hide completely instead of showing fallback */
  hideIfDisabled?: boolean;
}

/**
 * Component to gate access to features based on plan modules
 * Renders children if module is enabled, otherwise shows upgrade prompt
 */
export function ModuleGate({ module, children, fallback, hideIfDisabled = false }: ModuleGateProps) {
  const { hasModule, hasAnyModule, plan, loading } = usePlanFeatures();

  // While loading, render nothing to avoid flash
  if (loading) {
    return null;
  }

  // Check if module is enabled
  const modules = Array.isArray(module) ? module : [module];
  const isEnabled = hasAnyModule(modules);

  if (isEnabled) {
    return <>{children}</>;
  }

  // Module not enabled
  if (hideIfDisabled) {
    return null;
  }

  // Show fallback or default upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default upgrade prompt
  const moduleNames = modules.map((m) => MODULE_DISPLAY_NAMES[m]).join(', ');

  return (
    <Card className="border-dashed border-2 border-muted">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle className="text-lg">Module non disponible</CardTitle>
        <CardDescription>
          {moduleNames} n'est pas inclus dans votre offre {PLAN_CONFIGS[plan]?.displayName}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button variant="outline" className="gap-2">
          <ArrowUpRight className="h-4 w-4" />
          Voir les offres
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Page-level gate that shows a full-page message when module is not available
 */
export function ModuleGatePage({ module, children }: { module: PlanModule | PlanModule[]; children: ReactNode }) {
  const { hasModule, hasAnyModule, plan, planDisplayName, loading } = usePlanFeatures();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted border-t-primary" />
      </div>
    );
  }

  const modules = Array.isArray(module) ? module : [module];
  const isEnabled = hasAnyModule(modules);

  if (isEnabled) {
    return <>{children}</>;
  }

  const moduleNames = modules.map((m) => MODULE_DISPLAY_NAMES[m]).join(', ');

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Module non inclus</h1>
          <p className="text-muted-foreground">
            <span className="font-medium">{moduleNames}</span> n'est pas disponible avec votre offre{' '}
            <span className="font-medium">{planDisplayName}</span>.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Contactez votre administrateur ou passez à une offre supérieure pour accéder à cette fonctionnalité.
        </p>
        <Button variant="default" className="gap-2">
          <ArrowUpRight className="h-4 w-4" />
          Voir les offres disponibles
        </Button>
      </div>
    </div>
  );
}
