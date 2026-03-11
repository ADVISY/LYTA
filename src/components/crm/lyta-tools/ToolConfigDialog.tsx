import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Save, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ToolConfigDialogProps {
  app: AppWithConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (appId: string, config: Record<string, unknown>) => void;
}

// Apps that require a custom URL from the tenant
const URL_CONFIGURABLE_SLUGS = [
  '3cx', 'bexio', 'outlook', 'onedrive',
];

const configHints: Record<string, { label: string; placeholder: string; help: string }> = {
  '3cx': {
    label: 'URL de votre serveur 3CX',
    placeholder: 'https://votre-cabinet.3cx.ch',
    help: 'Entrez l\'URL de votre Web Client 3CX. Vous la trouverez dans votre panneau d\'administration 3CX.',
  },
  bexio: {
    label: 'URL de votre instance Bexio',
    placeholder: 'https://office.bexio.com',
    help: 'URL de connexion à votre compte Bexio. Par défaut : https://office.bexio.com',
  },
  outlook: {
    label: 'URL Outlook Web',
    placeholder: 'https://outlook.office.com',
    help: 'URL de votre Outlook Web. Par défaut : https://outlook.office.com',
  },
  onedrive: {
    label: 'URL OneDrive',
    placeholder: 'https://onedrive.live.com',
    help: 'URL de votre OneDrive. Par défaut : https://onedrive.live.com',
  },
};

export function ToolConfigDialog({ app, open, onOpenChange, onSave }: ToolConfigDialogProps) {
  const [customUrl, setCustomUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  useEffect(() => {
    if (app) {
      const tenantConfig = (app.tenantSetting as any)?.config_json as Record<string, unknown> | undefined;
      setCustomUrl((tenantConfig?.custom_launch_url as string) || '');
      setUrlError('');
    }
  }, [app]);

  if (!app) return null;

  const slug = app.slug;
  const hint = configHints[slug];
  const needsUrl = URL_CONFIGURABLE_SLUGS.includes(slug);

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return true; // empty = use default
    try {
      const parsed = new URL(url.trim());
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    if (needsUrl && customUrl.trim() && !validateUrl(customUrl)) {
      setUrlError('URL invalide. Utilisez un format comme https://exemple.com');
      return;
    }

    const config: Record<string, unknown> = {};
    if (customUrl.trim()) {
      config.custom_launch_url = customUrl.trim();
    }

    onSave(app.id, config);
    onOpenChange(false);
  };

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
              <DialogTitle>Configurer {app.name}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Paramètres spécifiques à votre cabinet
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {needsUrl && hint && (
            <div className="space-y-2">
              <Label htmlFor="custom-url">{hint.label}</Label>
              <Input
                id="custom-url"
                type="url"
                value={customUrl}
                onChange={(e) => { setCustomUrl(e.target.value); setUrlError(''); }}
                placeholder={hint.placeholder}
              />
              {urlError && (
                <p className="text-xs text-destructive">{urlError}</p>
              )}
              <p className="text-xs text-muted-foreground">{hint.help}</p>
            </div>
          )}

          {!needsUrl && (
            <Alert variant="default" className="bg-muted/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Cette application n'a pas de configuration personnalisable pour le moment.
                L'URL par défaut sera utilisée.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!needsUrl}>
            <Save className="w-4 h-4 mr-2" />
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
