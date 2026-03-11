import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserTenant } from '@/hooks/useUserTenant';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Pilot feature restricted to Advisy tenant until validation.

export interface ExternalApp {
  id: string;
  slug: string;
  name: string;
  category: string;
  description_short: string | null;
  description_long: string | null;
  logo_url: string | null;
  connection_type: string;
  launch_mode: string;
  launch_url: string | null;
  embed_allowed: boolean;
  oauth_supported: boolean;
  smartflow_compatible: boolean;
  integration_level: number;
  is_premium: boolean;
  is_beta: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface UserAppConnection {
  id: string;
  app_id: string;
  connection_status: string;
  connected_at: string | null;
  last_used_at: string | null;
  metadata_json: Record<string, unknown>;
}

export interface TenantAppSetting {
  id: string;
  app_id: string;
  is_enabled: boolean;
  is_visible: boolean;
  config_json: Record<string, unknown>;
}

export type AppWithConnection = ExternalApp & {
  connection?: UserAppConnection;
  tenantSetting?: TenantAppSetting;
};

export function useLytaToolsEnabled() {
  const { tenantId } = useUserTenant();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setEnabled(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from('tenant_feature_flags')
        .select('lyta_tools_enabled')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      setEnabled(data?.lyta_tools_enabled ?? false);
      setLoading(false);
    };

    check();
  }, [tenantId]);

  return { enabled, loading };
}

export function useLytaTools() {
  const { tenantId } = useUserTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const [apps, setApps] = useState<AppWithConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchApps = useCallback(async () => {
    if (!tenantId || !user) return;

    try {
      // Fetch all active apps
      const { data: appsData, error: appsError } = await supabase
        .from('external_apps')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (appsError) throw appsError;

      // Fetch user connections
      const { data: connections } = await supabase
        .from('user_app_connections')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);

      // Fetch tenant app settings
      const { data: tenantSettings } = await supabase
        .from('tenant_app_settings')
        .select('*')
        .eq('tenant_id', tenantId);

      // Merge data
      const merged: AppWithConnection[] = (appsData || []).map((app: any) => ({
        ...app,
        connection: connections?.find((c: any) => c.app_id === app.id),
        tenantSetting: tenantSettings?.find((s: any) => s.app_id === app.id),
      }));

      setApps(merged);
    } catch (err) {
      console.error('Error fetching LYTA Tools apps:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, user]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const connectApp = useCallback(async (appId: string) => {
    if (!tenantId || !user) return;

    try {
      const { error } = await supabase
        .from('user_app_connections')
        .upsert({
          tenant_id: tenantId,
          user_id: user.id,
          app_id: appId,
          connection_status: 'connected',
          connected_at: new Date().toISOString(),
          metadata_json: {},
        }, { onConflict: 'tenant_id,user_id,app_id' });

      if (error) throw error;

      // Log usage
      await supabase.from('app_usage_logs').insert({
        tenant_id: tenantId,
        user_id: user.id,
        app_id: appId,
        action_type: 'connect',
      });

      toast({ title: 'Application connectée', description: 'La connexion a été établie avec succès.' });
      await fetchApps();
    } catch (err) {
      console.error('Error connecting app:', err);
      toast({ title: 'Erreur', description: 'Impossible de connecter l\'application.', variant: 'destructive' });
    }
  }, [tenantId, user, fetchApps, toast]);

  const disconnectApp = useCallback(async (appId: string) => {
    if (!tenantId || !user) return;

    try {
      const { error } = await supabase
        .from('user_app_connections')
        .update({ connection_status: 'disconnected' })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('app_id', appId);

      if (error) throw error;

      await supabase.from('app_usage_logs').insert({
        tenant_id: tenantId,
        user_id: user.id,
        app_id: appId,
        action_type: 'disconnect',
      });

      toast({ title: 'Application déconnectée' });
      await fetchApps();
    } catch (err) {
      console.error('Error disconnecting app:', err);
      toast({ title: 'Erreur', description: 'Impossible de déconnecter l\'application.', variant: 'destructive' });
    }
  }, [tenantId, user, fetchApps, toast]);

  const openApp = useCallback(async (app: AppWithConnection) => {
    if (!tenantId || !user) return;

    // Log usage
    await supabase.from('app_usage_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      app_id: app.id,
      action_type: 'open',
    });

    // Update last_used_at
    if (app.connection?.connection_status === 'connected') {
      await supabase
        .from('user_app_connections')
        .update({ last_used_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('app_id', app.id);
    }

    if (app.launch_url) {
      window.open(app.launch_url, '_blank', 'noopener,noreferrer');
    }
  }, [tenantId, user]);

  const toggleTenantApp = useCallback(async (appId: string, isEnabled: boolean) => {
    if (!tenantId) return;

    try {
      const { error } = await supabase
        .from('tenant_app_settings')
        .upsert({
          tenant_id: tenantId,
          app_id: appId,
          is_enabled: isEnabled,
          is_visible: true,
        }, { onConflict: 'tenant_id,app_id' });

      if (error) throw error;
      await fetchApps();
    } catch (err) {
      console.error('Error toggling tenant app:', err);
    }
  }, [tenantId, fetchApps]);

  const updateTenantAppConfig = useCallback(async (appId: string, config: Record<string, unknown>) => {
    if (!tenantId) return;

    try {
      const { error } = await supabase
        .from('tenant_app_settings')
        .upsert({
          tenant_id: tenantId,
          app_id: appId,
          is_enabled: true,
          is_visible: true,
          config_json: config,
        }, { onConflict: 'tenant_id,app_id' });

      if (error) throw error;
      toast({ title: 'Configuration sauvegardée', description: 'Les paramètres de l\'application ont été mis à jour.' });
      await fetchApps();
    } catch (err) {
      console.error('Error updating tenant app config:', err);
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder la configuration.', variant: 'destructive' });
    }
  }, [tenantId, fetchApps, toast]);

  // Filtered apps
  const filteredApps = apps.filter(app => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!app.name.toLowerCase().includes(q) && !app.category.toLowerCase().includes(q) && !(app.description_short || '').toLowerCase().includes(q)) {
        return false;
      }
    }
    if (categoryFilter !== 'all' && app.category !== categoryFilter) return false;
    if (statusFilter === 'connected' && app.connection?.connection_status !== 'connected') return false;
    if (statusFilter === 'available' && app.connection?.connection_status === 'connected') return false;
    if (statusFilter === 'beta' && !app.is_beta) return false;
    if (statusFilter === 'premium' && !app.is_premium) return false;
    return true;
  });

  const connectedApps = apps.filter(a => a.connection?.connection_status === 'connected');
  const categories = [...new Set(apps.map(a => a.category))];

  return {
    apps,
    filteredApps,
    connectedApps,
    categories,
    loading,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    connectApp,
    disconnectApp,
    openApp,
    toggleTenantApp,
    refetch: fetchApps,
  };
}
