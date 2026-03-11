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
import { Globe, Link2, Shield, CheckCircle2, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState, useEffect, useRef } from 'react';

interface ToolConnectDialogProps {
  app: AppWithConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (appId: string) => void;
}

const connectionTypeInfo: Record<string, { label: string; description: string }> = {
  link: { label: 'Lien externe', description: 'Connectez-vous à l\'application dans une fenêtre popup, puis revenez ici pour l\'utiliser dans LYTA.' },
  oauth: { label: 'OAuth 2.0', description: 'Connectez-vous à l\'application, LYTA conservera votre session active.' },
  api_key: { label: 'Clé API', description: 'Connectez-vous à l\'application pour activer l\'intégration.' },
  custom: { label: 'Personnalisé', description: 'Connectez-vous à l\'application pour démarrer.' },
};

export function ToolConnectDialog({ app, open, onOpenChange, onConfirm }: ToolConnectDialogProps) {
  const [connecting, setConnecting] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Monitor popup close to auto-confirm connection
  useEffect(() => {
    if (!connecting || !popupRef.current) return;

    timerRef.current = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        // Popup was closed → user finished login
        if (timerRef.current) clearInterval(timerRef.current);
        popupRef.current = null;
        setConnecting(false);
        if (app) {
          onConfirm(app.id);
          onOpenChange(false);
        }
      }
    }, 500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [connecting, app, onConfirm, onOpenChange]);

  if (!app) return null;

  const info = connectionTypeInfo[app.connection_type] || connectionTypeInfo.link;

  const handleConnectViaPopup = () => {
    const url = app.launch_url;
    if (!url) {
      // No URL → direct connect
      onConfirm(app.id);
      onOpenChange(false);
      return;
    }

    // Open login page in popup
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      `lyta-connect-${app.slug}`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    if (popup) {
      popupRef.current = popup;
      setConnecting(true);
    } else {
      // Popup blocked → fallback: open in new tab and confirm manually
      window.open(url, '_blank', 'noopener,noreferrer');
      onConfirm(app.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!connecting) onOpenChange(v); }}>
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
          {connecting ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
                <ExternalLink className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Connexion en cours…</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Connectez-vous à <strong>{app.name}</strong> dans la fenêtre popup.<br />
                  Elle se fermera automatiquement ou fermez-la une fois connecté.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // User confirms they're done
                  if (popupRef.current && !popupRef.current.closed) {
                    popupRef.current.close();
                  }
                  if (timerRef.current) clearInterval(timerRef.current);
                  popupRef.current = null;
                  setConnecting(false);
                  onConfirm(app.id);
                  onOpenChange(false);
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                J'ai terminé ma connexion
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{info.description}</p>

              <div className="rounded-lg border p-3 space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Comment ça marche</h4>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Une fenêtre s'ouvre pour vous connecter à {app.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Connectez-vous avec vos identifiants habituels</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Fermez la fenêtre — l'app s'ouvre dans LYTA</span>
                  </div>
                  {app.smartflow_compatible && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>Compatibilité SmartFlow (futur)</span>
                    </div>
                  )}
                </div>
              </div>

              <Alert variant="default" className="bg-muted/50">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Votre session sera partagée via votre navigateur. LYTA ne stocke aucun mot de passe.
                  L'application s'affichera directement dans votre espace de travail.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        {!connecting && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleConnectViaPopup}>
              <Link2 className="w-4 h-4 mr-2" />
              Se connecter à {app.name}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
