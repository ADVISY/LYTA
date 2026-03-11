// Pilot feature restricted to Advisy tenant until validation.

import { useState, useCallback } from 'react';
import { useLytaTools, AppWithConnection } from '@/hooks/useLytaTools';
import { useUserRole } from '@/hooks/useUserRole';
import { ToolCard, ToolDetailDialog, ToolConnectDialog, ToolConfigDialog, ToolsAdminPanel, ToolTabsManager } from '@/components/crm/lyta-tools';
import type { OpenTab } from '@/components/crm/lyta-tools';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  LayoutGrid, 
  List, 
  Puzzle, 
  Link2, 
  Monitor,
  Zap,
  FlaskConical,
  Settings,
  AppWindow,
} from 'lucide-react';

const categoryLabels: Record<string, string> = {
  all: 'Toutes',
  communication: 'Communication',
  stockage: 'Stockage',
  productivite: 'Productivité',
  finance: 'Finance',
  signature: 'Signature',
  ia: 'IA / Automatisation',
  telephonie: 'Téléphonie',
};

export default function CRMLytaTools() {
  const {
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
    updateTenantAppConfig,
  } = useLytaTools();
  
  const { isAdmin, isManager } = useUserRole();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [detailApp, setDetailApp] = useState<AppWithConnection | null>(null);
  const [connectDialogApp, setConnectDialogApp] = useState<AppWithConnection | null>(null);
  const [activeTab, setActiveTab] = useState('catalog');

  // --- Embedded tabs state ---
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeEmbedTabId, setActiveEmbedTabId] = useState<string | null>(null);

  const openInTab = useCallback((app: AppWithConnection) => {
    const existing = openTabs.find(t => t.app.id === app.id);
    if (existing) {
      setActiveEmbedTabId(existing.id);
      setActiveTab('workspace');
      return;
    }
    const newTab: OpenTab = {
      id: `tab-${app.id}-${Date.now()}`,
      app,
      hasError: false,
    };
    setOpenTabs(prev => [...prev, newTab]);
    setActiveEmbedTabId(newTab.id);
    setActiveTab('workspace');
  }, [openTabs]);

  const closeTab = useCallback((tabId: string) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      if (activeEmbedTabId === tabId) {
        setActiveEmbedTabId(next.length > 0 ? next[next.length - 1].id : null);
        if (next.length === 0) setActiveTab('catalog');
      }
      return next;
    });
  }, [activeEmbedTabId]);

  // KPIs
  const totalApps = apps.length;
  const connectedCount = connectedApps.length;
  const embedCompatible = apps.filter(a => a.embed_allowed).length;
  const smartflowReady = apps.filter(a => a.smartflow_compatible).length;

  const handleConnect = (appId: string) => {
    const app = apps.find(a => a.id === appId);
    if (app) setConnectDialogApp(app);
  };

  const handleConfirmConnect = async (appId: string) => {
    await connectApp(appId);
  };

  const handleOpenApp = useCallback((app: AppWithConnection) => {
    if (app.embed_allowed) {
      openInTab(app);
    } else {
      openApp(app);
    }
  }, [openInTab, openApp]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">LYTA Tools</h1>
            <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-xs">
              <FlaskConical className="w-3 h-3 mr-1" />
              Version pilote
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Connectez vos applications externes et centralisez vos outils de travail directement dans LYTA.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Puzzle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{loading ? '—' : totalApps}</p>
              <p className="text-xs text-muted-foreground">Disponibles</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{loading ? '—' : connectedCount}</p>
              <p className="text-xs text-muted-foreground">Connectées</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{loading ? '—' : embedCompatible}</p>
              <p className="text-xs text-muted-foreground">Embed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{loading ? '—' : smartflowReady}</p>
              <p className="text-xs text-muted-foreground">SmartFlow</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList>
            <TabsTrigger value="catalog">
              <Puzzle className="w-4 h-4 mr-1.5" />
              Catalogue
            </TabsTrigger>
            <TabsTrigger value="connected">
              <Link2 className="w-4 h-4 mr-1.5" />
              Connectées ({connectedCount})
            </TabsTrigger>
            {openTabs.length > 0 && (
              <TabsTrigger value="workspace" className="relative">
                <AppWindow className="w-4 h-4 mr-1.5" />
                Workspace
                <Badge variant="secondary" className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {openTabs.length}
                </Badge>
              </TabsTrigger>
            )}
            {(isAdmin || isManager) && (
              <TabsTrigger value="admin">
                <Settings className="w-4 h-4 mr-1.5" />
                Administration
              </TabsTrigger>
            )}
          </TabsList>
          {activeTab !== 'workspace' && (
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Search & Filters (hidden in workspace) */}
        {activeTab !== 'workspace' && (
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une application..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {categoryLabels[cat] || cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="connected">Connectées</SelectItem>
                <SelectItem value="available">Disponibles</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="beta">Bêta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Catalog Tab */}
        <TabsContent value="catalog" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-52 rounded-lg" />
              ))}
            </div>
          ) : filteredApps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Puzzle className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium mb-1">Aucune application trouvée</h3>
                <p className="text-sm text-muted-foreground">Essayez de modifier vos filtres de recherche.</p>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredApps.map(app => (
                <ToolCard
                  key={app.id}
                  app={app}
                  onConnect={handleConnect}
                  onDisconnect={disconnectApp}
                  onOpen={handleOpenApp}
                  onViewDetails={setDetailApp}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredApps.map(app => (
                <ToolCard
                  key={app.id}
                  app={app}
                  onConnect={handleConnect}
                  onDisconnect={disconnectApp}
                  onOpen={handleOpenApp}
                  onViewDetails={setDetailApp}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Connected Tab */}
        <TabsContent value="connected" className="mt-4">
          {connectedApps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Link2 className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium mb-1">Aucune application connectée</h3>
                <p className="text-sm text-muted-foreground">
                  Parcourez le catalogue pour connecter vos premiers outils.
                </p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('catalog')}>
                  Voir le catalogue
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" 
              : "space-y-2"
            }>
              {connectedApps.map(app => (
                <ToolCard
                  key={app.id}
                  app={app}
                  onConnect={handleConnect}
                  onDisconnect={disconnectApp}
                  onOpen={handleOpenApp}
                  onViewDetails={setDetailApp}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Workspace Tab - Embedded apps */}
        <TabsContent value="workspace" className="mt-4">
          <ToolTabsManager
            tabs={openTabs}
            activeTabId={activeEmbedTabId}
            onSetActiveTab={setActiveEmbedTabId}
            onCloseTab={closeTab}
            onOpenExternal={openApp}
            onShowCatalog={() => setActiveTab('catalog')}
          />
        </TabsContent>

        {/* Admin Tab */}
        {(isAdmin || isManager) && (
          <TabsContent value="admin" className="mt-4">
            <ToolsAdminPanel apps={apps} onToggleApp={toggleTenantApp} />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <ToolDetailDialog
        app={detailApp}
        open={!!detailApp}
        onOpenChange={(open) => !open && setDetailApp(null)}
        onConnect={handleConnect}
        onDisconnect={disconnectApp}
        onOpen={handleOpenApp}
        onEmbed={openInTab}
      />
      <ToolConnectDialog
        app={connectDialogApp}
        open={!!connectDialogApp}
        onOpenChange={(open) => !open && setConnectDialogApp(null)}
        onConfirm={handleConfirmConnect}
      />
    </div>
  );
}
