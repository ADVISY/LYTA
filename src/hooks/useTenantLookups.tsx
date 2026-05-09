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
    } catch (e: any) {
      // Surface the full Supabase error (code/message/details/hint) so a
      // 400 / 403 stops being a silent "Erreur" toast and we can debug
      // RLS or schema issues from F12 console.
      console.error(`[useTenantLookup:${table}] fetch error`, {
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
        raw: e,
      });
      toast({
        title: `Erreur de chargement (${table})`,
        description:
          e?.message ||
          e?.details ||
          "Impossible de charger la liste — voir la console (F12) pour le détail.",
        variant: "destructive",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [table, toast]);

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
      // tenant_document_types and tenant_billable_services share the
      // (id, tenant_id, code, label, is_system, sort_order) shape, but
      // only `tenant_billable_services` has the service-specific columns
      // (description, default_amount, default_unit). Sending those keys
      // to tenant_document_types triggers a PostgREST 400
      // "Could not find the 'X' column in the schema cache". Strip
      // them out for document types.
      const isServiceTable = table === "tenant_billable_services";
      const basePayload: Record<string, unknown> = {
        code: input.code,
        label: input.label,
        sort_order: input.sort_order,
        tenant_id: tenantId,
        is_system: false,
      };
      if (isServiceTable) {
        basePayload.description = input.description ?? null;
        basePayload.default_amount = input.default_amount ?? null;
        basePayload.default_unit = input.default_unit ?? null;
      }
      const { data, error } = await (supabase as any)
        .from(table)
        .insert(basePayload)
        .select()
        .single();
      if (error) throw error;
      toast({ title: "Ajouté" });
      await fetchRows();
      return data as LookupRow;
    } catch (e: any) {
      console.error(`[useTenantLookup:${table}] create error`, {
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
        raw: e,
      });
      const description =
        e?.message ||
        e?.details ||
        e?.hint ||
        (typeof e === "string" ? e : null) ||
        "Erreur inconnue — voir la console (F12) pour le détail.";
      toast({
        title: "Erreur lors de l'ajout",
        description,
        variant: "destructive",
      });
      return null;
    }
  };

  const update: UseTenantLookupReturn["update"] = async (id, patch) => {
    try {
      // Same column-stripping as create — keep only fields that exist
      // on the target table to avoid "column not found" 400s.
      const isServiceTable = table === "tenant_billable_services";
      const cleanPatch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (patch.label !== undefined) cleanPatch.label = patch.label;
      if (patch.sort_order !== undefined) cleanPatch.sort_order = patch.sort_order;
      if (isServiceTable) {
        if (patch.description !== undefined) cleanPatch.description = patch.description;
        if (patch.default_amount !== undefined) cleanPatch.default_amount = patch.default_amount;
        if (patch.default_unit !== undefined) cleanPatch.default_unit = patch.default_unit;
      }
      const { error } = await (supabase as any)
        .from(table)
        .update(cleanPatch)
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Modifié" });
      await fetchRows();
    } catch (e: any) {
      console.error(`[useTenantLookup:${table}] update error`, {
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
        raw: e,
      });
      const msg =
        e?.message || e?.details || e?.hint || (e instanceof Error ? e.message : "Erreur");
      toast({ title: "Erreur lors de la modification", description: msg, variant: "destructive" });
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
