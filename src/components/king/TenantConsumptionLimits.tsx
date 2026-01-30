import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  HardDrive,
  MessageSquare,
  Mail,
  Brain,
  Users,
  Plus,
  Minus,
  RotateCcw,
  History,
  AlertTriangle,
  CheckCircle,
  Save,
} from "lucide-react";
import {
  useTenantLimits,
  useTenantConsumption,
  useTenantLimitAudit,
  useUpdateTenantLimits,
  useResetTenantConsumption,
  getConsumptionColor,
  getAlertLevel,
} from "@/hooks/useTenantConsumption";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface TenantConsumptionLimitsProps {
  tenantId: string;
  tenantName: string;
}

export function TenantConsumptionLimits({ tenantId, tenantName }: TenantConsumptionLimitsProps) {
  const { data: limits, isLoading: limitsLoading } = useTenantLimits(tenantId);
  const { data: consumption, isLoading: consumptionLoading } = useTenantConsumption(tenantId);
  const { data: auditLogs } = useTenantLimitAudit(tenantId);
  const updateLimits = useUpdateTenantLimits();
  const resetConsumption = useResetTenantConsumption();

  // Form state - initialized from limits when available
  const [formLimits, setFormLimits] = useState({
    storage_limit_gb: limits?.storage_limit_gb ?? 5,
    sms_limit_monthly: limits?.sms_limit_monthly ?? 100,
    email_limit_monthly: limits?.email_limit_monthly ?? 500,
    ai_docs_limit_monthly: limits?.ai_docs_limit_monthly ?? 50,
    users_limit: limits?.users_limit ?? 5,
    ai_enabled: limits?.ai_enabled ?? true,
  });
  const [changeReason, setChangeReason] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Update form when limits load for the first time
  if (limits && !initialized) {
    setFormLimits({
      storage_limit_gb: limits.storage_limit_gb,
      sms_limit_monthly: limits.sms_limit_monthly,
      email_limit_monthly: limits.email_limit_monthly,
      ai_docs_limit_monthly: limits.ai_docs_limit_monthly,
      users_limit: limits.users_limit,
      ai_enabled: limits.ai_enabled,
    });
    setInitialized(true);
  }

  const handleLimitChange = (field: keyof typeof formLimits, value: number | boolean) => {
    setFormLimits(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateLimits.mutateAsync({
      tenantId,
      updates: formLimits,
      reason: changeReason || undefined,
    });
    setHasChanges(false);
    setChangeReason("");
  };

  const handleReset = async (type: "sms" | "email" | "ai_docs") => {
    await resetConsumption.mutateAsync({ tenantId, type });
  };

  // Calculate percentages
  const storagePercent = limits && consumption 
    ? Math.round((consumption.storage_used_bytes / (limits.storage_limit_gb * 1024 * 1024 * 1024)) * 100)
    : 0;
  const smsPercent = limits && consumption 
    ? Math.round((consumption.sms_used / limits.sms_limit_monthly) * 100)
    : 0;
  const emailPercent = limits && consumption 
    ? Math.round((consumption.email_used / limits.email_limit_monthly) * 100)
    : 0;
  const aiDocsPercent = limits && consumption 
    ? Math.round((consumption.ai_docs_used / limits.ai_docs_limit_monthly) * 100)
    : 0;
  const usersPercent = limits && consumption 
    ? Math.round((consumption.active_users / limits.users_limit) * 100)
    : 0;

  const storageUsedGB = consumption 
    ? (consumption.storage_used_bytes / (1024 * 1024 * 1024)).toFixed(2)
    : "0";

  if (limitsLoading || consumptionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const LimitControl = ({
    label,
    icon: Icon,
    currentValue,
    limitValue,
    percent,
    unit,
    limitField,
    canReset,
    resetType,
    disabled,
  }: {
    label: string;
    icon: React.ElementType;
    currentValue: string | number;
    limitValue: number;
    percent: number;
    unit?: string;
    limitField: keyof typeof formLimits;
    canReset?: boolean;
    resetType?: "sms" | "email" | "ai_docs";
    disabled?: boolean;
  }) => {
    const alertLevel = getAlertLevel(percent);
    const colorClass = getConsumptionColor(percent);

    return (
      <Card className={cn(disabled && "opacity-60")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("p-2 rounded-lg", percent >= 85 ? "bg-destructive/10" : "bg-primary/10")}>
                <Icon className={cn("h-4 w-4", percent >= 85 ? "text-destructive" : "text-primary")} />
              </div>
              <CardTitle className="text-base">{label}</CardTitle>
            </div>
            {alertLevel && (
              <Badge variant={alertLevel === "critical" ? "destructive" : "outline"} className="text-xs">
                {alertLevel === "critical" ? "Critique" : alertLevel === "warning" ? "Attention" : "Vigilance"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Utilisé</span>
              <span className="font-semibold">
                {currentValue}{unit} / {limitValue}{unit}
              </span>
            </div>
            <div className="relative">
              <Progress value={Math.min(percent, 100)} className="h-2 bg-muted" />
              <div 
                className={cn("absolute top-0 left-0 h-full rounded-full transition-all", colorClass)}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {percent}%
            </div>
          </div>

          <Separator />

          {/* Limit Controls */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Limite</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const currentLimit = formLimits[limitField] as number;
                  if (currentLimit > 1) {
                    handleLimitChange(limitField, currentLimit - (limitField === "storage_limit_gb" ? 1 : limitField === "users_limit" ? 1 : 10));
                  }
                }}
                disabled={disabled}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                value={formLimits[limitField] as number}
                onChange={(e) => handleLimitChange(limitField, parseFloat(e.target.value) || 0)}
                className="h-8 w-24 text-center"
                disabled={disabled}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const currentLimit = formLimits[limitField] as number;
                  handleLimitChange(limitField, currentLimit + (limitField === "storage_limit_gb" ? 1 : limitField === "users_limit" ? 1 : 10));
                }}
                disabled={disabled}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
          </div>

          {/* Reset Action */}
          {canReset && resetType && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full" disabled={disabled}>
                  <RotateCcw className="h-3 w-3 mr-2" />
                  Réinitialiser le compteur
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Réinitialiser le compteur ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action remet le compteur à zéro pour le mois en cours. 
                    L'opération sera enregistrée dans l'historique d'audit.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleReset(resetType)}>
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Save */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Consommation & Limites</h3>
          <p className="text-sm text-muted-foreground">
            Gérez les quotas et surveillez la consommation de {tenantName}
          </p>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-3">
            <Input
              placeholder="Raison du changement (optionnel)"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              className="w-64"
            />
            <Button onClick={handleSave} disabled={updateLimits.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateLimits.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        )}
      </div>

      {/* Alert Banner if any limit is near */}
      {[storagePercent, smsPercent, emailPercent, aiDocsPercent, usersPercent].some(p => p >= 85) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                Un ou plusieurs quotas sont proches de la limite. Envisagez d'augmenter les limites.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Limits Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <LimitControl
          label="Stockage"
          icon={HardDrive}
          currentValue={storageUsedGB}
          limitValue={formLimits.storage_limit_gb}
          percent={storagePercent}
          unit=" GB"
          limitField="storage_limit_gb"
        />
        <LimitControl
          label="SMS"
          icon={MessageSquare}
          currentValue={consumption?.sms_used || 0}
          limitValue={formLimits.sms_limit_monthly}
          percent={smsPercent}
          unit="/mois"
          limitField="sms_limit_monthly"
          canReset
          resetType="sms"
        />
        <LimitControl
          label="Emails"
          icon={Mail}
          currentValue={consumption?.email_used || 0}
          limitValue={formLimits.email_limit_monthly}
          percent={emailPercent}
          unit="/mois"
          limitField="email_limit_monthly"
          canReset
          resetType="email"
        />
        <LimitControl
          label="Documents IA"
          icon={Brain}
          currentValue={consumption?.ai_docs_used || 0}
          limitValue={formLimits.ai_docs_limit_monthly}
          percent={aiDocsPercent}
          unit="/mois"
          limitField="ai_docs_limit_monthly"
          canReset
          resetType="ai_docs"
          disabled={!formLimits.ai_enabled}
        />
        <LimitControl
          label="Utilisateurs"
          icon={Users}
          currentValue={consumption?.active_users || 0}
          limitValue={formLimits.users_limit}
          percent={usersPercent}
          unit=""
          limitField="users_limit"
        />

        {/* AI Toggle Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base">Module IA</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Activer ou désactiver l'accès aux fonctionnalités d'intelligence artificielle pour ce tenant.
            </p>
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-toggle" className="font-medium">
                {formLimits.ai_enabled ? "Activé" : "Désactivé"}
              </Label>
              <Switch
                id="ai-toggle"
                checked={formLimits.ai_enabled}
                onCheckedChange={(checked) => handleLimitChange("ai_enabled", checked)}
              />
            </div>
            {formLimits.ai_enabled && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle className="h-4 w-4" />
                <span>Les fonctionnalités IA sont accessibles</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit History */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="audit">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historique des modifications
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {auditLogs && auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm"
                  >
                    <div>
                      <span className="font-medium capitalize">{log.limit_type.replace("_", " ")}</span>
                      <span className="text-muted-foreground mx-2">:</span>
                      <span className="text-muted-foreground">{log.old_value}</span>
                      <span className="mx-2">→</span>
                      <span className="font-medium">{log.new_value}</span>
                      {log.reason && (
                        <span className="text-muted-foreground ml-2">({log.reason})</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune modification enregistrée
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
