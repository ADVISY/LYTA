import { useState, useCallback } from 'react';
import { AppWithConnection } from '@/hooks/useLytaTools';
import { Button } from '@/components/ui/button';
import { X, ExternalLink, Globe, AlertTriangle, RotateCw, Maximize2, Minimize2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export interface OpenTab {
  id: string;
  app: AppWithConnection;
  hasError: boolean;
}

interface ToolTabsManagerProps {
  tabs: OpenTab[];
  activeTabId: string | null;
  onSetActiveTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onOpenExternal: (app: AppWithConnection) => void;
  onShowCatalog: () => void;
}

export function ToolTabsManager({
  tabs,
  activeTabId,
  onSetActiveTab,
  onCloseTab,
  onOpenExternal,
  onShowCatalog,
}: ToolTabsManagerProps) {
  const [tabErrors, setTabErrors] = useState<Record<string, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleEmbedError = useCallback((tabId: string) => {
    setTabErrors(prev => ({ ...prev, [tabId]: true }));
  }, []);

  if (tabs.length === 0) return null;

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className={cn(
      "flex flex-col bg-card border border-border rounded-lg overflow-hidden transition-all",
      isFullscreen ? "fixed inset-0 z-50 rounded-none" : "h-[calc(100vh-280px)] min-h-[500px]"
    )}>
      {/* Tab bar */}
      <div className="flex items-center bg-muted/50 border-b border-border">
        <ScrollArea className="flex-1">
          <div className="flex items-center">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onSetActiveTab(tab.id)}
                className={cn(
                  "group flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-r border-border transition-colors min-w-[140px] max-w-[200px]",
                  tab.id === activeTabId
                    ? "bg-card text-foreground border-b-2 border-b-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                {tab.app.logo_url ? (
                  <img src={tab.app.logo_url} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                ) : (
                  <Globe className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="truncate flex-1 text-left">{tab.app.name}</span>
                {tabErrors[tab.id] && (
                  <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded p-0.5 transition-opacity flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Tab bar actions */}
        <div className="flex items-center gap-1 px-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Réduire" : "Plein écran"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onShowCatalog}
          >
            + App
          </Button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 relative">
        {tabs.map((tab) => {
          const hasError = tabErrors[tab.id] || !tab.app.embed_allowed;

          return (
            <div
              key={tab.id}
              className={cn(
                "absolute inset-0",
                tab.id === activeTabId ? "z-10 visible" : "z-0 invisible"
              )}
            >
              {hasError ? (
                <div className="flex flex-col items-center justify-center h-full px-4">
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center mb-4">
                    {tab.app.logo_url ? (
                      <img src={tab.app.logo_url} alt={tab.app.name} className="w-10 h-10 object-contain" />
                    ) : (
                      <Globe className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{tab.app.name}</h3>
                  <Alert className="max-w-md mb-6">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {tabErrors[tab.id]
                        ? "L'ouverture intégrée a échoué. Cette application bloque l'affichage en iframe."
                        : "Cette application ne permet pas l'ouverture intégrée."}
                      <br />Ouvrez-la dans un nouvel onglet.
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => onCloseTab(tab.id)}>
                      <X className="w-4 h-4 mr-2" />
                      Fermer l'onglet
                    </Button>
                    <Button onClick={() => onOpenExternal(tab.app)}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Ouvrir dans un nouvel onglet
                    </Button>
                  </div>
                </div>
              ) : (
                <iframe
                  src={tab.app.launch_url || ''}
                  className="w-full h-full border-0 bg-white"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
                  allow="camera; microphone; clipboard-write; clipboard-read"
                  title={tab.app.name}
                  onError={() => handleEmbedError(tab.id)}
                  onLoad={(e) => {
                    try {
                      const iframe = e.target as HTMLIFrameElement;
                      if (iframe.contentDocument === null) {
                        handleEmbedError(tab.id);
                      }
                    } catch {
                      // Cross-origin - expected
                    }
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
