import { AppWithConnection } from '@/hooks/useLytaTools';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Globe, Link2, Shield, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ToolConnectDialogProps {
  app: AppWithConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (appId: string) => void;
}

const connectionTypeInfo: Record<string, { label: string; description: string }> = {
  link: { label: 'Lien externe', description: 'Aucune authentification requise. L\'application s\'ouvrira dans un nouvel onglet.' },
  oauth: { label: 'OAuth 2.0', description: 'Vous serez redirigé vers l\'application pour autoriser l\'accès. (Simulation pilote)' },
  api_key: { label: 'Clé API', description: 'Une clé API sera configurée pour votre compte. (Simulation pilote)' },
  custom: { label: 'Personnalisé', description: 'Configuration personnalisée requise.' },
};

export function ToolConnectDialog({ app, open, onOpenChange, onConfirm }: ToolConnectDialogProps) {
  if (!app) return null;

  const info = connectionTypeInfo[app.connection_type] || connectionTypeInfo.link;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
              {app.logo_url ? (
                <img src={app.logo_url} alt={app.name} className="w-8 h-8 object-contain" />
              ) : (
                <Globe className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <DialogTitle>Connecter {app.name}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {info.label}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{info.description}</p>

          <div className="rounded-lg border p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Permissions demandées</h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Accès en lecture aux données de l'application</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Ouverture depuis LYTA</span>
              </div>
              {app.smartflow_compatible && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Compatibilité SmartFlow (futur)</span>
                </div>
              )}
            </div>
          </div>

          <Alert variant="default" className="bg-muted/50">
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Certaines applications externes peuvent limiter l'ouverture intégrée pour des raisons de sécurité.
              Les accès sont liés à votre compte et aux autorisations de votre cabinet.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => { onConfirm(app.id); onOpenChange(false); }}>
            <Link2 className="w-4 h-4 mr-2" />
            Confirmer la connexion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
