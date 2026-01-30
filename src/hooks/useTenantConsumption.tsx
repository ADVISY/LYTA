import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TenantConsumptionData {
  tenant_id: string;
  tenant_name: string;
  tenant_status: string;
  tenant_plan: string;
  storage_limit_gb: number;
  sms_limit_monthly: number;
  email_limit_monthly: number;
  ai_docs_limit_monthly: number;
  users_limit: number;
  ai_enabled: boolean;
  storage_used_bytes: number;
  storage_used_gb: number;
  sms_used: number;
  email_used: number;
  ai_docs_used: number;
  active_users: number;
  storage_percent: number;
  sms_percent: number;
  email_percent: number;
  ai_docs_percent: number;
  users_percent: number;
  current_year: number;
  current_month: number;
}

export interface TenantLimits {
  id: string;
  tenant_id: string;
  storage_limit_gb: number;
  sms_limit_monthly: number;
  email_limit_monthly: number;
  ai_docs_limit_monthly: number;
  users_limit: number;
  ai_enabled: boolean;
}

export interface TenantLimitAudit {
  id: string;
  tenant_id: string;
  changed_by: string | null;
  limit_type: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
}

// Hook to fetch all tenant consumption summaries
export function useTenantConsumptionSummary() {
  return useQuery({
    queryKey: ["tenant-consumption-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tenant_consumption_summary");
      
      if (error) throw error;
      return (data || []) as TenantConsumptionData[];
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

// Hook to fetch a single tenant's limits
export function useTenantLimits(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["tenant-limits", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from("tenant_limits")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      
      if (error) throw error;
      return data as TenantLimits | null;
    },
    enabled: !!tenantId,
  });
}

// Hook to fetch a single tenant's consumption
export function useTenantConsumption(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["tenant-consumption", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1;
      
      const { data, error } = await supabase
        .from("tenant_consumption")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("period_year", year)
        .eq("period_month", month)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

// Hook to fetch limit audit history
export function useTenantLimitAudit(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["tenant-limit-audit", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from("tenant_limits_audit")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return (data || []) as TenantLimitAudit[];
    },
    enabled: !!tenantId,
  });
}

// Hook for updating tenant limits with audit logging
export function useUpdateTenantLimits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      tenantId,
      updates,
      reason,
    }: {
      tenantId: string;
      updates: Partial<TenantLimits>;
      reason?: string;
    }) => {
      // First, get current limits for audit
      const { data: currentLimits } = await supabase
        .from("tenant_limits")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      // Update the limits
      const { error: updateError } = await supabase
        .from("tenant_limits")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);

      if (updateError) throw updateError;

      // Log each changed field to audit
      for (const [key, newValue] of Object.entries(updates)) {
        const oldValue = currentLimits?.[key as keyof typeof currentLimits];
        if (String(oldValue) !== String(newValue)) {
          await supabase.rpc("log_tenant_limit_change", {
            p_tenant_id: tenantId,
            p_limit_type: key,
            p_old_value: String(oldValue),
            p_new_value: String(newValue),
            p_reason: reason || null,
          });
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenant-limits", variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenant-limit-audit", variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenant-consumption-summary"] });
      toast({
        title: "Limites mises à jour",
        description: "Les modifications ont été enregistrées et auditées.",
      });
    },
    onError: (error) => {
      console.error("Error updating limits:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les limites.",
        variant: "destructive",
      });
    },
  });
}

// Hook for resetting consumption counters (admin action)
export function useResetTenantConsumption() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      tenantId,
      type,
    }: {
      tenantId: string;
      type: "sms" | "email" | "ai_docs";
    }) => {
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1;

      const updateField = {
        sms: { sms_used: 0 },
        email: { email_used: 0 },
        ai_docs: { ai_docs_used: 0 },
      }[type];

      const { error } = await supabase
        .from("tenant_consumption")
        .update({
          ...updateField,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("period_year", year)
        .eq("period_month", month);

      if (error) throw error;

      // Log to audit
      await supabase.rpc("log_tenant_limit_change", {
        p_tenant_id: tenantId,
        p_limit_type: `${type}_reset`,
        p_old_value: "usage",
        p_new_value: "0",
        p_reason: "Réinitialisation admin",
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenant-consumption", variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenant-consumption-summary"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-limit-audit", variables.tenantId] });
      toast({
        title: "Compteur réinitialisé",
        description: "Le compteur a été remis à zéro.",
      });
    },
    onError: (error) => {
      console.error("Error resetting consumption:", error);
      toast({
        title: "Erreur",
        description: "Impossible de réinitialiser le compteur.",
        variant: "destructive",
      });
    },
  });
}

// Helper function to get color class based on percentage
// Using semantic classes for proper theming
export function getConsumptionColor(percent: number): string {
  if (percent >= 85) return "bg-destructive";
  if (percent >= 60) return "bg-primary/80";
  return "bg-primary";
}

export function getConsumptionTextColor(percent: number): string {
  if (percent >= 85) return "text-destructive";
  if (percent >= 60) return "text-primary/80";
  return "text-primary";
}

// Get alert level based on percentage
export function getAlertLevel(percent: number): "critical" | "warning" | "caution" | null {
  if (percent >= 100) return "critical";
  if (percent >= 85) return "warning";
  if (percent >= 70) return "caution";
  return null;
}
