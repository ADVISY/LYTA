import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { PlanModule, MODULE_DISPLAY_NAMES, PLAN_CONFIGS } from '@/config/plans';
import { Lock, ArrowUpRight, Crown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const handleUpgrade = () => {
    navigate('/crm/parametres?tab=abonnement');
  };

  return (
    <Card className="border-dashed border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-lg">{t('plans.moduleNotAvailable', 'Module non disponible')}</CardTitle>
        <CardDescription className="space-y-1">
          <span className="font-medium text-foreground">{moduleNames}</span>
          <br />
          {t('plans.notIncludedIn', "n'est pas inclus dans votre offre")}{' '}
          <Badge variant="secondary" className="ml-1">{PLAN_CONFIGS[plan]?.displayName}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center pt-2">
        <Button onClick={handleUpgrade} className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
          <Crown className="h-4 w-4" />
          {t('plans.upgradeNow', 'Mettre à niveau')}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Page-level gate that shows a full-page message when module is not available
 */
export function ModuleGatePage({ module, children }: { module: PlanModule | PlanModule[]; children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const handleUpgrade = () => {
    navigate('/crm/parametres?tab=abonnement');
  };

  // Find plans that include this module
  const plansWithModule = Object.entries(PLAN_CONFIGS)
    .filter(([_, config]) => modules.some(m => config.modules.includes(m)))
    .map(([_, config]) => config.displayName);

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-8">
      <div className="max-w-lg text-center space-y-6">
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        </div>
        
        <div className="relative">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-lg">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 shadow-lg">
            <Crown className="h-4 w-4 text-white" />
          </div>
        </div>
        
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">{t('plans.moduleNotIncluded', 'Module non inclus')}</h1>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{moduleNames}</span>{' '}
            {t('plans.notAvailableWith', "n'est pas disponible avec votre offre")}{' '}
            <Badge variant="outline" className="mx-1">{planDisplayName}</Badge>
          </p>
        </div>
        
        {plansWithModule.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              {t('plans.availableWith', 'Disponible avec les offres :')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {plansWithModule.map((planName) => (
                <Badge key={planName} variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {planName}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        <p className="text-sm text-muted-foreground">
          {t('plans.contactAdmin', 'Contactez votre administrateur ou passez à une offre supérieure pour accéder à cette fonctionnalité.')}
        </p>
        
        <Button onClick={handleUpgrade} size="lg" className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg">
          <ArrowUpRight className="h-4 w-4" />
          {t('plans.seeAvailablePlans', 'Voir les offres disponibles')}
        </Button>
      </div>
    </div>
  );
}

/**
 * Inline badge to show when a feature requires upgrade
 */
export function UpgradeBadge({ module, className }: { module: PlanModule; className?: string }) {
  const { t } = useTranslation();
  const { hasModule } = usePlanFeatures();
  
  if (hasModule(module)) {
    return null;
  }
  
  return (
    <Badge variant="outline" className={`gap-1 text-xs border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/20 ${className}`}>
      <Crown className="h-3 w-3" />
      {t('plans.pro', 'Pro')}
    </Badge>
  );
}
