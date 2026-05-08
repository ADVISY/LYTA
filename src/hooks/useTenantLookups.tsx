import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "@/hooks/useUserTenant";
import { useToast } from "@/hooks/use-toast";

/**
 * Shared shape for tenant lookup rows (document_types, billable_services).
 * `tenant_id IS NULL` ⇒ system row, immutable from UI.
 */
export type LookupRow = {
  id: string;
  tenant_id: string | null;
  code: string;
  label: string;
  is_system: boolean;
  sort_order: number;
  // Service-specific (optional in document_types):
  description?: string | null;
  default_amount?: number | null;
  default_unit?: string | null;
};

type Table = "tenant_document_types" | "tenant_billable_services";

interface UseTenantLookupOptions {
  table: Table;
}

interface UseTenantLookupReturn {
  rows: LookupRow[];
  loading: boolean;
  refresh: () => Promise<void>;
  create: (input: Omit<LookupRow, "id" | "tenant_id" | "is_system">) => Promise<LookupRow | null>;
  update: (id: string, patch: Partial<Pick<LookupRow, "label" | "sort_order" | "description" | "default_amount" | "default_unit">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function useTenantLookup({ table }: UseTenantLookupOptions): UseTenantLookupReturn {
  const { tenantId, loading: tenantLoading } = useUserTenant();
  const { toast } = useToast();
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from(table)
        .select("*")
        .order("is_system", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true });
      if (error) throw error;
      setRows((data ?? []) as LookupRow[]);
    } catch (e) {
      console.error(`[useTenantLookup:${table}] fetch error`, e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [table]);

  useEffect(() => {
    if (!tenantLoading) {
      void fetchRows();
    }
  }, [tenantLoading, fetchRows]);

  const create: UseTenantLookupReturn["create"] = async (input) => {
    if (!tenantId) {
      toast({ title: "Tenant manquant", variant: "destructive" });
      return null;
    }
    try {
      const payload = {
        ...input,
        tenant_id: tenantId,
        is_system: false,
      };
      const { data, error } = await (supabase as any)
        .from(table)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      toast({ title: "Ajouté" });
      await fetchRows();
      return data as LookupRow;
    } catch (e) {
      console.error(`[useTenantLookup:${table}] create error`, e);
      const msg = e instanceof Error ? e.message : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
      return null;
    }
  };

  const update: UseTenantLookupReturn["update"] = async (id, patch) => {
    try {
      const { error } = await (supabase as any)
        .from(table)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Modifié" });
      await fetchRows();
    } catch (e) {
      console.error(`[useTenantLookup:${table}] update error`, e);
      const msg = e instanceof Error ? e.message : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  };

  const remove: UseTenantLookupReturn["remove"] = async (id) => {
    try {
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Supprimé" });
      await fetchRows();
    } catch (e) {
      console.error(`[useTenantLookup:${table}] delete error`, e);
      const msg = e instanceof Error ? e.message : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  };

  return { rows, loading, refresh: fetchRows, create, update, remove };
}

export function useTenantDocumentTypes() {
  return useTenantLookup({ table: "tenant_document_types" });
}

export function useTenantBillableServices() {
  return useTenantLookup({ table: "tenant_billable_services" });
}
