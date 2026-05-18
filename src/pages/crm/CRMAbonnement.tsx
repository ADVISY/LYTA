import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useTenantSeats } from '@/hooks/useTenantSeats';
import { usePermissions } from '@/hooks/usePermissions';
import { PLAN_CONFIGS, MODULE_DISPLAY_NAMES, MODULE_TRANSLATION_KEYS, getPlansInOrder, PlanModule } from '@/config/plans';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Check,
  X,
  Users,
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  Crown,
  Zap,
  Star,
  Ban,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const PLAN_ICONS: Record<string, typeof Crown> = {
  start: Zap,
  pro: Star,
  prime: Crown,
  founder: Crown,
};

export default function CRMAbonnement() {
  const { t } = useTranslation();
  const plansRef = useRef<HTMLDivElement>(null);
  const { 
    plan, 
    planDisplayName, 
    enabledModules, 
    planStatus, 
    billingStatus,
    seatsIncluded,
    seatsPrice,
    loading: planLoading 
  } = usePlanFeatures();
  
  const { activeUsers, loading: seatsLoading } = useTenantSeats();
  const { can, isAdmin, isLoading: permissionsLoading } = usePermissions();
  const { toast } = useToast();

  // État annulation abonnement
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellationResult, setCancellationResult] = useState<{ period_end: string | null; message: string } | null>(null);

  const loading = planLoading || seatsLoading || permissionsLoading;
  const extraUsers = Math.max(0, activeUsers - seatsIncluded);
  const estimatedCost = extraUsers * seatsPrice;
  const availablePlans = getPlansInOrder();

  const scrollToPlans = () => {
    plansRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCancelSubscription = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-tenant-subscription', {
        body: { reason: cancelReason.trim() || undefined },
      });
      if (error) {
        let detail = error.message || 'Annulation échouée.';
        try {
          const ctx = (error as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            detail = body?.error || body?.message || detail;
          }
        } catch { /* keep generic */ }
        throw new Error(detail);
      }
      if (!data?.ok) throw new Error(data?.error || data?.message || 'Annulation échouée.');
      setCancellationResult({
        period_end: data.period_end || null,
        message: data.message || 'Annulation enregistrée.',
      });
      toast({
        title: 'Annulation enregistrée',
        description: data.message || 'Ton abonnement sera annulé à la fin de la période payée.',
      });
    } catch (e: any) {
      toast({
        title: 'Erreur annulation',
        description: e?.message || 'Erreur inattendue.',
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
    }
  };

  const allModules: PlanModule[] = [
    'clients', 'contracts', 'commissions', 'statements', 'membership',
    'payroll', 'emailing', 'automation', 'mandate_automation', 'client_portal'
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!isAdmin && !can('settings', 'update')) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Acces restreint</AlertTitle>
        <AlertDescription>
          Seul un administrateur du cabinet peut consulter l'abonnement.
        </AlertDescription>
      </Alert>
    );
  }

  const PlanIcon = PLAN_ICONS[plan] || Zap;

  const getBillingStatusLabel = () => {
    switch (billingStatus) {
      case 'paid': return t('subscription.paid');
      case 'trial': return t('subscription.trial');
      case 'past_due': return t('subscription.pastDue');
      default: return t('subscription.cancelled');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('subscription.title')}</h1>
        <p className="text-muted-foreground">{t('subscription.subtitle')}</p>
      </div>

      {/* Alerts */}
      {billingStatus === 'past_due' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('subscription.paymentOverdue')}</AlertTitle>
          <AlertDescription>
            {t('subscription.paymentOverdueDesc')}
          </AlertDescription>
        </Alert>
      )}

      {billingStatus === 'trial' && (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertTitle>{t('subscription.trialPeriod')}</AlertTitle>
          <AlertDescription>
            {t('subscription.trialPeriodDesc')}
          </AlertDescription>
        </Alert>
      )}

      {extraUsers > 0 && (
        <Alert>
          <Users className="h-4 w-4" />
          <AlertTitle>{t('subscription.extra')}</AlertTitle>
          <AlertDescription>
            {t('subscription.extraUsersAlert', { count: extraUsers })}
            {' '}{t('subscription.estimatedExtraCost')}: <strong>{estimatedCost} CHF/{t('common.month')}</strong>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlanIcon className="h-5 w-5 text-primary" />
              {t('subscription.yourPlan')}
            </CardTitle>
            <CardDescription>{t('subscription.currentPlanDetails')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('subscription.plan')}</span>
              <Badge variant="default" className="text-sm">
                {planDisplayName}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('subscription.status')}</span>
              <Badge variant={planStatus === 'active' ? 'default' : 'destructive'}>
                {planStatus === 'active' ? t('subscription.active') : t('subscription.suspended')}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('subscription.billing')}</span>
              <Badge variant={
                billingStatus === 'paid' ? 'default' : 
                billingStatus === 'trial' ? 'secondary' : 
                'destructive'
              }>
                {getBillingStatusLabel()}
              </Badge>
            </div>
            <div className="pt-4 border-t space-y-2">
              <p className="text-sm text-muted-foreground mb-2">
                {PLAN_CONFIGS[plan]?.description}
              </p>
              <Button variant="outline" className="w-full gap-2" onClick={scrollToPlans}>
                <ArrowUpRight className="h-4 w-4" />
                {t('subscription.viewOtherPlans')}
              </Button>
              <Button
                variant="ghost"
                className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => { setCancellationResult(null); setCancelReason(''); setCancelDialogOpen(true); }}
              >
                <Ban className="h-4 w-4" />
                Annuler mon abonnement
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {t('subscription.users')}
            </CardTitle>
            <CardDescription>{t('subscription.usersManagement')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('subscription.activeUsers')}</span>
              <span className="font-semibold">{activeUsers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('subscription.includedInPlan')}</span>
              <span className="font-semibold">{seatsIncluded}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('subscription.extra')}</span>
              <span className={extraUsers > 0 ? 'font-semibold text-amber-600' : 'font-semibold'}>
                {extraUsers}
              </span>
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-muted-foreground">{t('subscription.pricePerExtraUser')}</span>
              <span className="font-semibold">{seatsPrice} CHF/{t('common.month')}</span>
            </div>
            {extraUsers > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('subscription.estimatedExtraCost')}</span>
                <span className="font-bold text-amber-600">{estimatedCost} CHF/{t('common.month')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Available plans */}
      <Card ref={plansRef}>
        <CardHeader>
          <CardTitle>{t('subscription.availablePlans')}</CardTitle>
          <CardDescription>
            {t('subscription.availablePlansDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {availablePlans.map((planKey) => {
              const config = PLAN_CONFIGS[planKey];
              const PlanCardIcon = PLAN_ICONS[planKey] || Zap;
              const isCurrentPlan = planKey === plan;

              return (
                <div
                  key={planKey}
                  className={`rounded-lg border p-4 space-y-4 ${
                    isCurrentPlan ? 'border-primary bg-primary/5' : 'bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <PlanCardIcon className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold">{config.displayName}</h3>
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                      </div>
                    </div>
                    {isCurrentPlan && (
                      <Badge variant="default">{t('subscription.current')}</Badge>
                    )}
                  </div>

                  <div>
                    <span className="text-2xl font-bold">{config.monthlyPrice} CHF</span>
                    <span className="text-sm text-muted-foreground">/{t('common.month')}</span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('subscription.includedInPlan')}</span>
                      <span className="font-medium">{config.seatsIncluded}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('subscription.pricePerExtraUser')}</span>
                      <span className="font-medium">{config.extraSeatPrice} CHF</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('subscription.includedModules')}</span>
                      <span className="font-medium">{config.modules.length}</span>
                    </div>
                  </div>

                  <Button
                    variant={isCurrentPlan ? 'secondary' : 'default'}
                    className="w-full"
                    disabled={isCurrentPlan}
                    onClick={() => window.open('mailto:support@lyta.ch?subject=Changement%20d%27offre%20LYTA', '_blank')}
                  >
                    {isCurrentPlan ? t('subscription.currentPlan') : t('plans.upgradeNow', 'Mettre à niveau')}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modules */}
      <Card>
        <CardHeader>
          <CardTitle>{t('subscription.includedModules')}</CardTitle>
          <CardDescription>
            {t('subscription.modulesDescription', { plan: planDisplayName })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allModules.map((module) => {
              const isEnabled = enabledModules.includes(module);
              // Try to get translated label, fallback to static display name
              const translationKey = MODULE_TRANSLATION_KEYS[module];
              const translatedLabel = t(translationKey);
              const displayLabel = translatedLabel !== translationKey ? translatedLabel : MODULE_DISPLAY_NAMES[module];
              
              return (
                <div 
                  key={module} 
                  className={`flex items-center gap-2 p-3 rounded-lg border ${
                    isEnabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/50 border-muted'
                  }`}
                >
                  {isEnabled ? (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={isEnabled ? 'text-foreground' : 'text-muted-foreground'}>
                    {displayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cancellation dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={(open) => { if (!cancelling) setCancelDialogOpen(open); }}>
        <DialogContent>
          {cancellationResult ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  Annulation enregistrée
                </DialogTitle>
                <DialogDescription>{cancellationResult.message}</DialogDescription>
              </DialogHeader>
              <Alert>
                <AlertDescription>
                  Tu gardes l'accès complet à LYTA jusqu'à la fin de la période payée
                  {cancellationResult.period_end && (
                    <> (<strong>{new Date(cancellationResult.period_end).toLocaleDateString('fr-CH')}</strong>)</>
                  )}.
                  Si tu changes d'avis, contacte <a className="underline" href="mailto:support@lyta.ch">support@lyta.ch</a> avant cette date.
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button onClick={() => setCancelDialogOpen(false)}>Fermer</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Annuler ton abonnement LYTA ?
                </DialogTitle>
                <DialogDescription>
                  Tu gardes l'accès jusqu'à la fin de la période déjà payée (pas de remboursement
                  pro-rata). Aucun prélèvement supplémentaire ne sera fait.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Conséquences de l'annulation</AlertTitle>
                  <AlertDescription className="text-sm">
                    À la fin de la période payée, ton cabinet sera désactivé : collaborateurs ne pourront plus se connecter,
                    données conservées 30 jours puis purgées. Tes clients (espace-client) garderont leurs comptes.
                  </AlertDescription>
                </Alert>
                <div>
                  <Label htmlFor="cancel-reason">Raison de l'annulation (optionnel)</Label>
                  <Textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value.slice(0, 1000))}
                    placeholder="Aide-nous à comprendre — ça nous permettra de progresser."
                    rows={3}
                    disabled={cancelling}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{cancelReason.length}/1000</p>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
                  Garder mon abonnement
                </Button>
                <Button variant="destructive" onClick={handleCancelSubscription} disabled={cancelling}>
                  {cancelling ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Annulation…</>
                  ) : (
                    <><Ban className="h-4 w-4 mr-2" /> Confirmer l'annulation</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
