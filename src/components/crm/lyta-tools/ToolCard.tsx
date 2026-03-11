import { AppWithConnection } from '@/hooks/useLytaTools';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ExternalLink, 
  Link2, 
  Unlink, 
  Zap, 
  Crown, 
  FlaskConical, 
  Monitor,
  Globe,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolCardProps {
  app: AppWithConnection;
  onConnect: (appId: string) => void;
  onDisconnect: (appId: string) => void;
  onOpen: (app: AppWithConnection) => void;
  onViewDetails: (app: AppWithConnection) => void;
}

const categoryLabels: Record<string, string> = {
  communication: 'Communication',
  stockage: 'Stockage',
  productivite: 'Productivité',
  finance: 'Finance',
  signature: 'Signature',
  ia: 'IA / Automatisation',
  telephonie: 'Téléphonie',
  conformite: 'Conformité',
  marketing: 'Marketing',
};

const categoryColors: Record<string, string> = {
  communication: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  stockage: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  productivite: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  finance: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  signature: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  ia: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  telephonie: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  conformite: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  marketing: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
};

export function ToolCard({ app, onConnect, onDisconnect, onOpen, onViewDetails }: ToolCardProps) {
  const isConnected = app.connection?.connection_status === 'connected';

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30",
      isConnected && "border-primary/20 bg-primary/[0.02]"
    )}>
      {/* Status indicator */}
      {isConnected && (
        <div className="absolute top-3 right-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      )}

      <CardContent className="p-5">
        {/* Header: Logo + Name */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {app.logo_url ? (
              <img 
                src={app.logo_url} 
                alt={app.name} 
                className="w-8 h-8 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <Globe className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{app.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {app.description_short}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <Badge variant="outline" className={cn("text-[10px] px-2 py-0", categoryColors[app.category])}>
            {categoryLabels[app.category] || app.category}
          </Badge>
          {app.embed_allowed && (
            <Badge variant="outline" className="text-[10px] px-2 py-0 bg-primary/5 border-primary/20 text-primary">
              <Monitor className="w-2.5 h-2.5 mr-0.5" /> Embed
            </Badge>
          )}
          {app.smartflow_compatible && (
            <Badge variant="outline" className="text-[10px] px-2 py-0 bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-950 dark:border-cyan-800 dark:text-cyan-300">
              <Zap className="w-2.5 h-2.5 mr-0.5" /> SmartFlow
            </Badge>
          )}
          {app.is_premium && (
            <Badge variant="outline" className="text-[10px] px-2 py-0 bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
              <Crown className="w-2.5 h-2.5 mr-0.5" /> Premium
            </Badge>
          )}
          {app.is_beta && (
            <Badge variant="outline" className="text-[10px] px-2 py-0 bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300">
              <FlaskConical className="w-2.5 h-2.5 mr-0.5" /> Bêta
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Button 
                size="sm" 
                className="flex-1 h-8 text-xs"
                onClick={() => onOpen(app)}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Ouvrir
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="h-8 text-xs"
                onClick={() => onViewDetails(app)}
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={() => onDisconnect(app.id)}
              >
                <Unlink className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="sm" 
                variant="outline"
                className="flex-1 h-8 text-xs"
                onClick={() => onConnect(app.id)}
              >
                <Link2 className="w-3.5 h-3.5 mr-1" />
                Connecter
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => onViewDetails(app)}
              >
                Détails
              </Button>
            </>
          )}
        </div>

        {/* Last used */}
        {isConnected && app.connection?.last_used_at && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Dernier accès : {new Date(app.connection.last_used_at).toLocaleDateString('fr-CH')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
