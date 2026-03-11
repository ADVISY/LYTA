import { AppWithConnection } from '@/hooks/useLytaTools';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, Users, Settings } from 'lucide-react';

interface ToolsAdminPanelProps {
  apps: AppWithConnection[];
  onToggleApp: (appId: string, isEnabled: boolean) => void;
  onConfigureApp?: (app: AppWithConnection) => void;
}

export function ToolsAdminPanel({ apps, onToggleApp, onConfigureApp }: ToolsAdminPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5" />
          Administration des applications
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Activez ou désactivez les applications disponibles pour votre cabinet. Configurez les URLs personnalisées pour les apps qui le nécessitent.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {apps.map(app => {
            const isEnabled = app.tenantSetting?.is_enabled !== false;
            const connectedCount = app.connection?.connection_status === 'connected' ? 1 : 0;
            const tenantConfig = (app.tenantSetting as any)?.config_json as Record<string, unknown> | undefined;
            const hasCustomUrl = !!tenantConfig?.custom_launch_url;

            return (
              <div 
                key={app.id} 
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {app.logo_url ? (
                      <img src={app.logo_url} alt={app.name} className="w-6 h-6 object-contain" />
                    ) : (
                      <Globe className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{app.name}</p>
                      {hasCustomUrl && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          URL personnalisée
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{app.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {connectedCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {connectedCount} connecté{connectedCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {onConfigureApp && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onConfigureApp(app)}
                      title="Configurer"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  )}
                  <Switch 
                    checked={isEnabled}
                    onCheckedChange={(checked) => onToggleApp(app.id, checked)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
