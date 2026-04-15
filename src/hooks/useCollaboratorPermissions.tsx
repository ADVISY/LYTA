import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";

export type PermissionModule = 
  | 'adresses' 
  | 'contrats' 
  | 'commissions' 
  | 'suivis' 
  | 'documents' 
  | 'compagnies' 
  | 'collaborateurs';

export interface CollaboratorPermission {
  id: string;
  collaborator_id: string;
  module: PermissionModule;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export type PermissionUpdate = {
  module: PermissionModule;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
};

export const MODULES: { value: PermissionModule; label: string }[] = [
  { value: 'adresses', label: 'Adresses (Clients)' },
  { value: 'contrats', label: 'Contrats' },
  { value: 'commissions', label: 'Commissions' },
  { value: 'suivis', label: 'Suivis' },
  { value: 'documents', label: 'Documents' },
  { value: 'compagnies', label: 'Compagnies' },
  { value: 'collaborateurs', label: 'Collaborateurs' },
];

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return "Une erreur est survenue";
};

export function useCollaboratorPermissions() {
  const { toast } = useToast();
  const { tenantId } = useUserTenant();
  const [permissions, setPermissions] = useState<CollaboratorPermission[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPermissions = useCallback(async (collaboratorId: string) => {
    try {
      setLoading(true);
      if (!tenantId) {
        throw new Error("Aucun cabinet assigné à cet utilisateur");
      }

      const { data, error } = await supabase
        .from('collaborator_permissions')
        .select('*')
        .eq('collaborator_id', collaboratorId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      setPermissions((data as CollaboratorPermission[]) || []);
      return (data as CollaboratorPermission[]) || [];
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: getErrorMessage(error),
        variant: "destructive"
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  const savePermissions = useCallback(async (
    collaboratorId: string, 
    permissionUpdates: PermissionUpdate[]
  ) => {
    try {
      setLoading(true);
      if (!tenantId) {
        throw new Error("Aucun cabinet assigné à cet utilisateur");
      }

      // Delete existing permissions for this collaborator
      const { error: deleteError } = await supabase
        .from('collaborator_permissions')
        .delete()
        .eq('collaborator_id', collaboratorId)
        .eq('tenant_id', tenantId);

      if (deleteError) throw deleteError;

      // Insert new permissions (only those with at least one permission enabled)
      const permissionsToInsert = permissionUpdates
        .filter(p => p.can_read || p.can_create || p.can_update || p.can_delete)
        .map(p => ({
          collaborator_id: collaboratorId,
          tenant_id: tenantId,
          module: p.module,
          can_read: p.can_read,
          can_create: p.can_create,
          can_update: p.can_update,
          can_delete: p.can_delete
        }));

      if (permissionsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('collaborator_permissions')
          .insert(permissionsToInsert);

        if (insertError) throw insertError;
      }

      toast({
        title: "Permissions mises à jour",
        description: "Les droits d'accès ont été enregistrés"
      });

      return true;
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: getErrorMessage(error),
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  // Helper to get permission for a specific module
  const getModulePermission = (module: PermissionModule): CollaboratorPermission | undefined => {
    return permissions.find(p => p.module === module);
  };

  // Get all modules with their current permissions (for UI)
  const getPermissionsMap = (): Record<PermissionModule, PermissionUpdate> => {
    const map = {} as Record<PermissionModule, PermissionUpdate>;
    
    MODULES.forEach(m => {
      const existing = permissions.find(p => p.module === m.value);
      map[m.value] = {
        module: m.value,
        can_read: existing?.can_read || false,
        can_create: existing?.can_create || false,
        can_update: existing?.can_update || false,
        can_delete: existing?.can_delete || false
      };
    });

    return map;
  };

  return {
    permissions,
    loading,
    fetchPermissions,
    savePermissions,
    getModulePermission,
    getPermissionsMap
  };
}
