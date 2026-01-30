import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  HardDrive, 
  MessageSquare, 
  Mail, 
  Brain, 
  Users,
  Settings,
  AlertTriangle,
  AlertCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { 
  TenantConsumptionData, 
  getConsumptionColor, 
  getConsumptionTextColor,
  getAlertLevel
} from "@/hooks/useTenantConsumption";
import { cn } from "@/lib/utils";

interface TenantConsumptionRowProps {
  data: TenantConsumptionData;
}

function ConsumptionBar({ 
  label, 
  icon: Icon, 
  used, 
  limit, 
  percent, 
  unit = "",
  disabled = false
}: { 
  label: string;
  icon: React.ElementType;
  used: number | string;
  limit: number | string;
  percent: number;
  unit?: string;
  disabled?: boolean;
}) {
  const colorClass = getConsumptionColor(percent);
  const textColorClass = getConsumptionTextColor(percent);
  const alertLevel = getAlertLevel(percent);

  return (
    <div className={cn("space-y-1.5", disabled && "opacity-50")}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{label}</span>
          {alertLevel === "critical" && (
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          )}
          {alertLevel === "warning" && (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive/70" />
          )}
        </div>
        <span className={cn("font-semibold", textColorClass)}>
          {used}{unit} / {limit}{unit}
        </span>
      </div>
      <div className="relative">
        <Progress 
          value={Math.min(percent, 100)} 
          className="h-2 bg-muted"
        />
        <div 
          className={cn("absolute top-0 left-0 h-full rounded-full transition-all", colorClass)}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{percent.toFixed(0)}%</span>
        {percent >= 100 && <Badge variant="destructive" className="text-xs py-0 h-4">Limite atteinte</Badge>}
        {percent >= 85 && percent < 100 && <Badge variant="outline" className="text-xs py-0 h-4 border-destructive/50 text-destructive">Attention</Badge>}
      </div>
    </div>
  );
}

export function TenantConsumptionRow({ data }: TenantConsumptionRowProps) {
  const navigate = useNavigate();

  // Check if any metric is at warning/critical level
  const hasAlerts = [
    data.storage_percent,
    data.sms_percent,
    data.email_percent,
    data.ai_enabled ? data.ai_docs_percent : 0,
    data.users_percent
  ].some(p => p >= 70);

  return (
    <div className="px-4 pb-4 pt-2 bg-muted/30 border-t">
      {/* Alert Banner */}
      {hasAlerts && (
        <div className="mb-4 p-2 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive font-medium">
            Un ou plusieurs quotas approchent de la limite
          </span>
        </div>
      )}

      {/* Consumption Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {/* Storage */}
        <ConsumptionBar
          label="Stockage"
          icon={HardDrive}
          used={data.storage_used_gb.toFixed(2)}
          limit={data.storage_limit_gb}
          percent={data.storage_percent}
          unit=" GB"
        />

        {/* SMS */}
        <ConsumptionBar
          label="SMS"
          icon={MessageSquare}
          used={data.sms_used}
          limit={data.sms_limit_monthly}
          percent={data.sms_percent}
        />

        {/* Email */}
        <ConsumptionBar
          label="Emails"
          icon={Mail}
          used={data.email_used}
          limit={data.email_limit_monthly}
          percent={data.email_percent}
        />

        {/* AI */}
        <ConsumptionBar
          label="Documents IA"
          icon={Brain}
          used={data.ai_docs_used}
          limit={data.ai_docs_limit_monthly}
          percent={data.ai_docs_percent}
          disabled={!data.ai_enabled}
        />

        {/* Users */}
        <ConsumptionBar
          label="Utilisateurs"
          icon={Users}
          used={data.active_users}
          limit={data.users_limit}
          percent={data.users_percent}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/king/tenants/${data.tenant_id}`);
          }}
        >
          <Settings className="h-4 w-4 mr-2" />
          Gérer le tenant
        </Button>
      </div>
    </div>
  );
}
