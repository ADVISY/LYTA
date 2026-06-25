/**
 * useClientFolders — CRUD des dossiers de documents d'un client.
 *
 * Modèle : un dossier libre par client (voir migration
 * 20260625160000_client_document_folders). Pas de nesting, pas de hiérarchie
 * pour l'instant — un simple plat (id, name, color) par client.
 *
 * Stratégie :
 *   - `list` (auto-fetch via React Query)
 *   - `create({ name, color? })`
 *   - `rename(id, newName)`
 *   - `remove(id)` — les documents qui pointaient sur ce dossier reviennent à
 *     la racine grâce à ON DELETE SET NULL sur la FK.
 *
 * Toutes les mutations invalident la query pour rafraîchir l'UI immédiatement.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "@/hooks/useUserTenant";
import { useToast } from "@/hooks/use-toast";

export interface ClientDocumentFolder {
  id: string;
  tenant_id: string;
  client_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateFolderInput {
  name: string;
  color?: string | null;
}

export function useClientFolders(clientId: string | null) {
  const { tenantId } = useUserTenant();
  const { toast } = useToast();
  const qc = useQueryClient();

  const queryKey = ["client_document_folders", clientId, tenantId];

  const { data: folders = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    enabled: !!clientId && !!tenantId,
    queryFn: async (): Promise<ClientDocumentFolder[]> => {
      // Cast `any` pour éviter les erreurs "Type instantiation excessively deep"
      // sur les requêtes Supabase. Pattern utilisé partout dans le repo.
      const sb: any = supabase;
      const { data, error } = await sb
        .from("client_document_folders")
        .select("*")
        .eq("client_id", clientId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as ClientDocumentFolder[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateFolderInput): Promise<ClientDocumentFolder> => {
      if (!clientId || !tenantId) throw new Error("Client ou tenant manquant");
      const { data: { user } } = await supabase.auth.getUser();
      const sb: any = supabase;
      const { data, error } = await sb
        .from("client_document_folders")
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          name: input.name.trim(),
          color: input.color ?? null,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ClientDocumentFolder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Dossier créé" });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      // Si l'unique constraint pète, on donne un message plus clair
      const isDup = msg.toLowerCase().includes("unique");
      toast({
        title: isDup ? "Nom déjà utilisé" : "Erreur",
        description: isDup
          ? "Un dossier porte déjà ce nom pour ce client."
          : msg,
        variant: "destructive",
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (args: { id: string; name: string }) => {
      const sb: any = supabase;
      const { error } = await sb
        .from("client_document_folders")
        .update({ name: args.name.trim() })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Dossier renommé" });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      const isDup = msg.toLowerCase().includes("unique");
      toast({
        title: isDup ? "Nom déjà utilisé" : "Erreur",
        description: isDup
          ? "Un dossier porte déjà ce nom pour ce client."
          : msg,
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const sb: any = supabase;
      const { error } = await sb
        .from("client_document_folders")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      // On invalide aussi les docs du client (ils ont peut-être perdu leur folder_id)
      qc.invalidateQueries({ queryKey: ["documents", clientId] });
      toast({
        title: "Dossier supprimé",
        description: "Les documents reviennent à la racine.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    },
  });

  return {
    folders,
    loading,
    refetch,
    createFolder: createMutation.mutateAsync,
    renameFolder: (id: string, name: string) =>
      renameMutation.mutateAsync({ id, name }),
    removeFolder: removeMutation.mutateAsync,
    creating: createMutation.isPending,
    renaming: renameMutation.isPending,
    removing: removeMutation.isPending,
  };
}
