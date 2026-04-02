import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface PlatformSetting {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
}

export function usePlatformSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading: loading } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("platform_settings")
        .select("*")
        .order("key");

      if (error) {
        console.error("Error fetching platform settings:", error);
        throw error;
      }

      return (data || []) as PlatformSetting[];
    },
    staleTime: 30000,
    retry: 2,
  });

  const getSetting = (key: string, defaultValue?: unknown): unknown => {
    const setting = settings?.find((s) => s.key === key);
    if (!setting) return defaultValue;
    return setting.value;
  };

  const updateSetting = (key: string, value: unknown) => {
    // Optimistic local update via query cache
    queryClient.setQueryData<PlatformSetting[]>(
      ["platform-settings"],
      (old) => {
        if (!old) return old;
        return old.map((s) =>
          s.key === key ? { ...s, value } : s
        );
      }
    );
  };

  const saveSettings = async (changes: Record<string, unknown>) => {
    setSaving(true);
    try {
      const entries = Object.entries(changes);
      for (const [key, value] of entries) {
        const { error } = await (supabase.from as any)("platform_settings")
          .upsert(
            {
              key,
              value: typeof value === "string" ? value : JSON.stringify(value),
              updated_at: new Date().toISOString(),
              updated_by: user?.id,
            },
            { onConflict: "key" }
          );

        if (error) {
          throw error;
        }
      }

      // Log the change in king_notifications
      const changedKeys = entries.map(([k]) => k).join(", ");
      await supabase.from("king_notifications").insert({
        title: "Paramètres modifiés",
        message: `Paramètres mis à jour : ${changedKeys}`,
        kind: "settings_changed",
        priority: "normal",
        metadata: { changed_keys: entries.map(([k]) => k), changed_by: user?.id },
      });

      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });

      toast({
        title: "Paramètres sauvegardés",
        description: "Les modifications ont été enregistrées avec succès.",
      });
    } catch (error: any) {
      console.error("Error saving platform settings:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder les paramètres.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    settings: settings || [],
    loading,
    getSetting,
    updateSetting,
    saveSettings,
    saving,
  };
}
