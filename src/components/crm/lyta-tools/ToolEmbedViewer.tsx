import { AppWithConnection } from '@/hooks/useLytaTools';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink, Globe, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';

interface ToolEmbedViewerProps {
  app: AppWithConnection;
  onBack: () => void;
  onOpenExternal: (app: AppWithConnection) => void;
}

export function ToolEmbedViewer({ app, onBack, onOpenExternal }: ToolEmbedViewerProps) {
  const [embedError, setEmbedError] = useState(false);

  if (embedError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center mb-4">
          {app.logo_url ? (
            <img src={app.logo_url} alt={app.name} className="w-10 h-10 object-contain" />
          ) : (
            <Globe className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        <h3 className="text-lg font-semibold mb-2">{app.name}</h3>
        
        <Alert className="max-w-md mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Cette application bloque l'affichage intégré (protection iframe).
            <br />Vous pouvez y accéder dans un nouvel onglet tout en restant dans LYTA.
          </AlertDescription>
        </Alert>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au catalogue
          </Button>
          <Button onClick={() => onOpenExternal(app)}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Ouvrir dans un nouvel onglet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border rounded-t-lg">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
          <div className="flex items-center gap-2">
            {app.logo_url && (
              <img src={app.logo_url} alt={app.name} className="w-5 h-5 object-contain" />
            )}
            <span className="font-medium text-sm">{app.name}</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>
        <Button variant="outline" size="sm" onClick={() => onOpenExternal(app)}>
          <ExternalLink className="w-3.5 h-3.5 mr-1" />
          Nouvel onglet
        </Button>
      </div>

      {/* Iframe */}
      <div className="flex-1 bg-white rounded-b-lg overflow-hidden">
        <iframe
          src={app.launch_url || ''}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allow="camera; microphone"
          title={app.name}
          onError={() => setEmbedError(true)}
          onLoad={(e) => {
            // Detect X-Frame-Options blocking
            try {
              const iframe = e.target as HTMLIFrameElement;
              // If we can't access contentDocument, it might be blocked
              if (iframe.contentDocument === null) {
                setEmbedError(true);
              }
            } catch {
              // Cross-origin - expected for external apps, not an error per se
            }
          }}
        />
      </div>
    </div>
  );
}
