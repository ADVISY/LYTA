import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";

export interface TenantRole {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  is_active: boolean;
  dashboard_scope: 'personal' | 'team' | 'global';
  can_see_own_commissions: boolean;
  can_see_team_commissions: boolean;
  can_see_all_commissions: boolean;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  module: string;
  action: string;
  allowed: boolean;
}

export interface UserTenantRole {
  id: string;
  user_id: string;
  role_id: string;
  tenant_id: string;
  assigned_by: string | null;
  assigned_at: string;
  tenant_roles?: TenantRole;
  profiles?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

// All available modules and actions
export const PERMISSION_MODULES = [
  { id: 'clients', label: 'Clients' },
  { id: 'contracts', label: 'Contrats' },
  { id: 'partners', label: 'Partenaires' },
  { id: 'products', label: 'Produits' },
  { id: 'collaborators', label: 'Collaborateurs' },
  { id: 'commissions', label: 'Commissions' },
  { id: 'decomptes', label: 'Décomptes' },
  { id: 'payout', label: 'Payout' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'settings', label: 'Paramètres' },
] as const;

export const PERMISSION_ACTIONS = [
  { id: 'view', label: 'Voir' },
  { id: 'create', label: 'Créer' },
  { id: 'update', label: 'Modifier' },
  { id: 'delete', label: 'Supprimer' },
  { id: 'export', label: 'Exporter' },
  { id: 'deposit', label: 'Déposer' },
  { id: 'cancel', label: 'Annuler' },
  { id: 'generate', label: 'Générer' },
  { id: 'validate', label: 'Valider' },
  { id: 'modify_rules', label: 'Modifier règles' },
] as const;

// Actions available per module
export const MODULE_ACTIONS: Record<string, string[]> = {
  clients: ['view', 'create', 'update', 'delete', 'export'],
  contracts: ['view', 'deposit', 'update', 'cancel', 'export'],
  partners: ['view', 'create', 'update', 'delete'],
  products: ['view', 'create', 'update', 'delete'],
  collaborators: ['view', 'create', 'update', 'delete', 'export'],
  commissions: ['view', 'modify_rules', 'export'],
  decomptes: ['view', 'generate', 'export'],
  payout: ['view', 'generate', 'validate', 'export'],
  dashboard: ['view'],
  settings: ['view', 'update'],
};

// Default roles configuration
export const DEFAULT_ROLES = [
  {
    name: 'Admin Cabinet',
    description: 'Accès complet à toutes les fonctionnalités',
    dashboard_scope: 'global' as const,
    can_see_own_commissions: true,
    can_see_team_commissions: true,
    can_see_all_commissions: true,
    permissions: Object.entries(MODULE_ACTIONS).flatMap(([module, actions]) =>
      actions.map(action => ({ module, action, allowed: true }))
    ),
  },
  {
    name: 'Manager',
    description: 'Accès équipe + clients personnels, dashboard équipe',
    dashboard_scope: 'team' as const,
    can_see_own_commissions: true,
    can_see_team_commissions: true,
    can_see_all_commissions: false,
    permissions: [
      { module: 'clients', action: 'view', allowed: true },
      { module: 'clients', action: 'create', allowed: true },
      { module: 'clients', action: 'update', allowed: true },
      { module: 'clients', action: 'export', allowed: true },
      { module: 'contracts', action: 'view', allowed: true },
      { module: 'contracts', action: 'deposit', allowed: true },
      { module: 'contracts', action: 'update', allowed: true },
      { module: 'contracts', action: 'export', allowed: true },
      { module: 'collaborators', action: 'view', allowed: true },
      { module: 'commissions', action: 'view', allowed: true },
      { module: 'decomptes', action: 'view', allowed: true },
      { module: 'dashboard', action: 'view', allowed: true },
      { module: 'settings', action: 'view', allowed: true },
    ],
  },
  {
    name: 'Agent',
    description: 'Accès uniquement à ses clients et contrats',
    dashboard_scope: 'personal' as const,
    can_see_own_commissions: true,
    can_see_team_commissions: false,
    can_see_all_commissions: false,
    permissions: [
      { module: 'clients', action: 'view', allowed: true },
      { module: 'clients', action: 'create', allowed: true },
      { module: 'clients', action: 'update', allowed: true },
      { module: 'contracts', action: 'view', allowed: true },
      { module: 'contracts', action: 'deposit', allowed: true },
      { module: 'commissions', action: 'view', allowed: true },
      { module: 'dashboard', action: 'view', allowed: true },
    ],
  },
  {
    name: 'Back-office',
    description: 'Voit tous les clients et contrats, aucun accès finance',
    dashboard_scope: 'global' as const,
    can_see_own_commissions: false,
    can_see_team_commissions: false,
    can_see_all_commissions: false,
    permissions: [
      { module: 'clients', action: 'view', allowed: true },
      { module: 'clients', action: 'create', allowed: true },
      { module: 'clients', action: 'update', allowed: true },
      { module: 'clients', action: 'export', allowed: true },
      { module: 'contracts', action: 'view', allowed: true },
      { module: 'contracts', action: 'deposit', allowed: true },
      { module: 'contracts', action: 'update', allowed: true },
      { module: 'contracts', action: 'export', allowed: true },
      { module: 'partners', action: 'view', allowed: true },
      { module: 'products', action: 'view', allowed: true },
      { module: 'collaborators', action: 'view', allowed: true },
      { module: 'dashboard', action: 'view', allowed: true },
      { module: 'settings', action: 'view', allowed: true },
    ],
  },
];

export function useTenantRoles() {
  const { tenantId } = useTenant();
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('tenant_roles')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (fetchError) throw fetchError;
      setRoles(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error loading roles:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const createRole = async (role: Partial<TenantRole>) => {
    if (!tenantId) return { error: 'No tenant' };

    try {
      const { data, error: createError } = await supabase
        .from('tenant_roles')
        .insert({
          tenant_id: tenantId,
          name: role.name,
          description: role.description,
          dashboard_scope: role.dashboard_scope || 'personal',
          can_see_own_commissions: role.can_see_own_commissions ?? true,
          can_see_team_commissions: role.can_see_team_commissions ?? false,
          can_see_all_commissions: role.can_see_all_commissions ?? false,
        })
        .select()
        .single();

      if (createError) throw createError;

      await loadRoles();
      toast.success('Rôle créé avec succès');
      return { data, error: null };
    } catch (err: any) {
      toast.error('Erreur lors de la création du rôle');
      return { data: null, error: err.message };
    }
  };

  const updateRole = async (roleId: string, updates: Partial<TenantRole>) => {
    try {
      const { error: updateError } = await supabase
        .from('tenant_roles')
        .update({
          name: updates.name,
          description: updates.description,
          is_active: updates.is_active,
          dashboard_scope: updates.dashboard_scope,
          can_see_own_commissions: updates.can_see_own_commissions,
          can_see_team_commissions: updates.can_see_team_commissions,
          can_see_all_commissions: updates.can_see_all_commissions,
        })
        .eq('id', roleId);

      if (updateError) throw updateError;

      await loadRoles();
      toast.success('Rôle mis à jour');
      return { error: null };
    } catch (err: any) {
      toast.error('Erreur lors de la mise à jour');
      return { error: err.message };
    }
  };

  const deleteRole = async (roleId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('tenant_roles')
        .delete()
        .eq('id', roleId);

      if (deleteError) throw deleteError;

      await loadRoles();
      toast.success('Rôle supprimé');
      return { error: null };
    } catch (err: any) {
      toast.error('Erreur lors de la suppression');
      return { error: err.message };
    }
  };

  const duplicateRole = async (roleId: string, newName: string) => {
    if (!tenantId) return { error: 'No tenant' };

    try {
      // Get the role to duplicate
      const { data: originalRole, error: fetchError } = await supabase
        .from('tenant_roles')
        .select('*')
        .eq('id', roleId)
        .single();

      if (fetchError) throw fetchError;

      // Create new role
      const { data: newRole, error: createError } = await supabase
        .from('tenant_roles')
        .insert({
          tenant_id: tenantId,
          name: newName,
          description: `Copie de ${originalRole.name}`,
          dashboard_scope: originalRole.dashboard_scope,
          can_see_own_commissions: originalRole.can_see_own_commissions,
          can_see_team_commissions: originalRole.can_see_team_commissions,
          can_see_all_commissions: originalRole.can_see_all_commissions,
          is_system_role: false,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Copy permissions
      const { data: originalPerms } = await supabase
        .from('tenant_role_permissions')
        .select('module, action, allowed')
        .eq('role_id', roleId);

      if (originalPerms && originalPerms.length > 0) {
        for (const p of originalPerms) {
          await supabase.from('tenant_role_permissions').insert({
            role_id: newRole.id,
            module: p.module as any,
            action: p.action as any,
            allowed: p.allowed,
          });
        }
      }

      await loadRoles();
      toast.success('Rôle dupliqué');
      return { data: newRole, error: null };
    } catch (err: any) {
      toast.error('Erreur lors de la duplication');
      return { data: null, error: err.message };
    }
  };

  // Initialize default roles for a new tenant
  const initializeDefaultRoles = async () => {
    if (!tenantId) return { error: 'No tenant' };

    try {
      // Check if roles already exist
      const { data: existingRoles } = await supabase
        .from('tenant_roles')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1);

      if (existingRoles && existingRoles.length > 0) {
        return { error: null, message: 'Roles already initialized' };
      }

      // Create default roles
      for (const roleConfig of DEFAULT_ROLES) {
        const { data: newRole, error: roleError } = await supabase
          .from('tenant_roles')
          .insert({
            tenant_id: tenantId,
            name: roleConfig.name,
            description: roleConfig.description,
            is_system_role: true,
            dashboard_scope: roleConfig.dashboard_scope,
            can_see_own_commissions: roleConfig.can_see_own_commissions,
            can_see_team_commissions: roleConfig.can_see_team_commissions,
            can_see_all_commissions: roleConfig.can_see_all_commissions,
          })
          .select()
          .single();

        if (roleError) {
          console.error('Error creating role:', roleError);
          continue;
        }

        // Create permissions for this role
        if (roleConfig.permissions.length > 0) {
          for (const p of roleConfig.permissions) {
            await supabase.from('tenant_role_permissions').insert({
              role_id: newRole.id,
              module: p.module as any,
              action: p.action as any,
              allowed: p.allowed,
            });
          }
        }
      }

      await loadRoles();
      toast.success('Rôles par défaut créés');
      return { error: null };
    } catch (err: any) {
      toast.error('Erreur lors de l\'initialisation des rôles');
      return { error: err.message };
    }
  };

  return {
    roles,
    isLoading,
    error,
    createRole,
    updateRole,
    deleteRole,
    duplicateRole,
    initializeDefaultRoles,
    refresh: loadRoles,
  };
}

// Hook for managing role permissions
export function useRolePermissions(roleId: string | null) {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!roleId) {
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tenant_role_permissions')
        .select('*')
        .eq('role_id', roleId);

      if (error) throw error;
      setPermissions(data || []);
    } catch (err) {
      console.error('Error loading permissions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const setPermission = async (module: string, action: string, allowed: boolean) => {
    if (!roleId) return;

    try {
      // Check if permission exists
      const existing = permissions.find(p => p.module === module && p.action === action);

      if (existing) {
        await supabase
          .from('tenant_role_permissions')
          .update({ allowed })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('tenant_role_permissions')
          .insert({
            role_id: roleId,
            module: module as any,
            action: action as any,
            allowed,
          });
      }

      await loadPermissions();
    } catch (err) {
      console.error('Error setting permission:', err);
      toast.error('Erreur lors de la mise à jour de la permission');
    }
  };

  const hasPermission = (module: string, action: string): boolean => {
    return permissions.some(p => p.module === module && p.action === action && p.allowed);
  };

  return {
    permissions,
    isLoading,
    setPermission,
    hasPermission,
    refresh: loadPermissions,
  };
}

// Hook for managing user-role assignments
export function useUserRoleAssignments() {
  const { tenantId } = useTenant();
  const [assignments, setAssignments] = useState<UserTenantRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAssignments = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_tenant_roles')
        .select(`
          *,
          tenant_roles (*)
        `)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      setAssignments((data || []) as any);
    } catch (err) {
      console.error('Error loading assignments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const assignRole = async (userId: string, roleId: string, assignedBy?: string) => {
    if (!tenantId) return { error: 'No tenant' };

    try {
      const { error } = await supabase
        .from('user_tenant_roles')
        .insert({
          user_id: userId,
          role_id: roleId,
          tenant_id: tenantId,
          assigned_by: assignedBy,
        });

      if (error) throw error;

      await loadAssignments();
      toast.success('Rôle assigné');
      return { error: null };
    } catch (err: any) {
      if (err.message?.includes('duplicate')) {
        toast.error('Ce rôle est déjà assigné à cet utilisateur');
      } else {
        toast.error('Erreur lors de l\'assignation');
      }
      return { error: err.message };
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('user_tenant_roles')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      await loadAssignments();
      toast.success('Rôle retiré');
      return { error: null };
    } catch (err: any) {
      toast.error('Erreur lors du retrait');
      return { error: err.message };
    }
  };

  const getUserRoles = (userId: string): UserTenantRole[] => {
    return assignments.filter(a => a.user_id === userId);
  };

  return {
    assignments,
    isLoading,
    assignRole,
    removeAssignment,
    getUserRoles,
    refresh: loadAssignments,
  };
}
