import { AppWithConnection } from '@/hooks/useLytaTools';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  ExternalLink, 
  Link2, 
  Unlink, 
  Zap, 
  Crown, 
  FlaskConical, 
  Monitor,
  Globe,
  Shield,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ToolDetailDialogProps {
  app: AppWithConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (appId: string) => void;
  onDisconnect: (appId: string) => void;
  onOpen: (app: AppWithConnection) => void;
  onEmbed: (app: AppWithConnection) => void;
}

const connectionTypeLabels: Record<string, string> = {
  link: 'Lien externe',
  oauth: 'OAuth 2.0',
  api_key: 'Clé API',
  custom: 'Personnalisé',
};

const integrationLevelLabels: Record<number, { label: string; description: string }> = {
  1: { label: 'Raccourci', description: 'Accès rapide via lien externe' },
  2: { label: 'Connexion', description: 'Connexion utilisateur avec authentification' },
  3: { label: 'Intégration', description: 'Embed / viewer intégré dans LYTA' },
  4: { label: 'Synchronisation', description: 'Synchronisation de données métier' },
  5: { label: 'SmartFlow', description: 'Automatisation complète via SmartFlow' },
};

export function ToolDetailDialog({ app, open, onOpenChange, onConnect, onDisconnect, onOpen, onEmbed }: ToolDetailDialogProps) {
  if (!app) return null;

  const isConnected = app.connection?.connection_status === 'connected';
  const level = integrationLevelLabels[app.integration_level] || integrationLevelLabels[1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
              {app.logo_url ? (
                <img src={app.logo_url} alt={app.name} className="w-10 h-10 object-contain" />
              ) : (
                <Globe className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl">{app.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{app.description_short}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Status */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              ● Connectée
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Non connectée
            </Badge>
          )}
          {app.is_premium && (
            <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
              <Crown className="w-3 h-3 mr-1" /> Premium
            </Badge>
          )}
          {app.is_beta && (
            <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
              <FlaskConical className="w-3 h-3 mr-1" /> Bêta
            </Badge>
          )}
        </div>

        <Separator />

        {/* Description */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Description</h4>
          <p className="text-sm text-muted-foreground">{app.description_long || app.description_short}</p>
        </div>

        {/* Technical details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Type de connexion</h4>
            <p className="text-sm">{connectionTypeLabels[app.connection_type] || app.connection_type}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Mode d'ouverture</h4>
            <p className="text-sm flex items-center gap-1">
              {app.embed_allowed ? (
                <><Monitor className="w-3.5 h-3.5" /> Embed / Onglet</>
              ) : (
                <><ExternalLink className="w-3.5 h-3.5" /> Nouvel onglet</>
              )}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Niveau d'intégration</h4>
            <p className="text-sm">{level.label}</p>
            <p className="text-xs text-muted-foreground">{level.description}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">SmartFlow</h4>
            <p className="text-sm flex items-center gap-1">
              {app.smartflow_compatible ? (
                <><Zap className="w-3.5 h-3.5 text-cyan-500" /> Compatible</>
              ) : (
                <span className="text-muted-foreground">Non disponible</span>
              )}
            </p>
          </div>
        </div>

        {/* Warnings */}
        {!app.embed_allowed && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Cette application ne permet pas l'ouverture intégrée pour des raisons de sécurité. Elle s'ouvrira dans un nouvel onglet.
            </AlertDescription>
          </Alert>
        )}

        <Alert variant="default" className="bg-muted/50">
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Les accès sont liés à votre compte et aux autorisations de votre cabinet.
          </AlertDescription>
        </Alert>

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Button className="flex-1" onClick={() => { onOpen(app); onOpenChange(false); }}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Ouvrir
              </Button>
              {app.embed_allowed && (
                <Button variant="outline" onClick={() => { onEmbed(app); onOpenChange(false); }}>
                  <Monitor className="w-4 h-4 mr-2" />
                  Ouvrir dans LYTA
                </Button>
              )}
              <Button variant="destructive" variant-size="sm" onClick={() => { onDisconnect(app.id); onOpenChange(false); }}>
                <Unlink className="w-4 h-4 mr-2" />
                Déconnecter
              </Button>
            </>
          ) : (
            <>
              <Button className="flex-1" onClick={() => { onConnect(app.id); onOpenChange(false); }}>
                <Link2 className="w-4 h-4 mr-2" />
                Connecter
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
