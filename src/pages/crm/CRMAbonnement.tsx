import { useTranslation } from 'react-i18next';
import { usePlanFeatures, useTenantSeats } from '@/hooks/usePlanFeatures';
import { PLAN_CONFIGS, MODULE_DISPLAY_NAMES, getPlansInOrder, PlanModule } from '@/config/plans';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Check, 
  X, 
  Users, 
  CreditCard, 
  AlertTriangle,
  ArrowUpRight,
  Crown,
  Zap,
  Star
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

  const loading = planLoading || seatsLoading;
  const extraUsers = Math.max(0, activeUsers - seatsIncluded);
  const estimatedCost = extraUsers * seatsPrice;

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
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                {PLAN_CONFIGS[plan]?.description}
              </p>
              <Button variant="outline" className="w-full gap-2">
                <ArrowUpRight className="h-4 w-4" />
                {t('subscription.viewOtherPlans')}
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
                    {MODULE_DISPLAY_NAMES[module]}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
