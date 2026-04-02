import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";

export interface EmailAutomationSettings {
  id: string;
  tenant_id: string;
  auto_welcome_email: boolean;
  auto_contract_deposit_email: boolean;
  auto_contract_signed_email: boolean;
  auto_mandat_signed_email: boolean;
  auto_account_created_email: boolean;
  enable_renewal_reminder: boolean;
  renewal_reminder_days_before: number;
  enable_birthday_email: boolean;
  enable_follow_up_reminder: boolean;
  follow_up_reminder_days: number;
  created_at: string;
  updated_at: string;
}

export const useEmailAutomation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["email-automation", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from("tenant_email_automation")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (error) {
        console.error("Error fetching email automation settings:", error);
        throw error;
      }

      return data as EmailAutomationSettings;
    },
    enabled: !!tenantId,
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<EmailAutomationSettings>) => {
      if (!tenantId) throw new Error("No tenant ID");

      const { data, error } = await supabase
        .from("tenant_email_automation")
        .update(updates)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-automation", tenantId] });
      toast({
        title: "Paramètres mis à jour",
        description: "Les paramètres d'automatisation email ont été sauvegardés.",
      });
    },
    onError: (error) => {
      console.error("Error updating email automation settings:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les paramètres.",
        variant: "destructive",
      });
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
  };
};
