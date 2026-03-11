// Pilot feature restricted to Advisy tenant until validation.
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserTenant } from '@/hooks/useUserTenant';
import { useAuth } from '@/hooks/useAuth';
import { useLytaToolsEnabled } from '@/hooks/useLytaTools';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Globe, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';

interface ConnectedApp {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  launch_url: string | null;
  embed_allowed: boolean;
  category: string;
}

export function ConnectedAppsDock() {
  const { enabled } = useLytaToolsEnabled();
  const { tenantId } = useUserTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    if (!enabled || !tenantId || !user) {
      setLoading(false);
      return;
    }

    const fetchConnected = async () => {
      try {
        // Get user's connected app IDs
        const { data: connections } = await supabase
          .from('user_app_connections')
          .select('app_id')
          .eq('tenant_id', tenantId)
          .eq('user_id', user.id)
          .eq('connection_status', 'connected');

        if (!connections || connections.length === 0) {
          setApps([]);
          setLoading(false);
          return;
        }

        const appIds = connections.map(c => c.app_id);

        // Get app details
        const { data: appsData } = await supabase
          .from('external_apps')
          .select('id, name, slug, logo_url, launch_url, embed_allowed, category')
          .in('id', appIds)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        setApps(appsData || []);
      } catch (err) {
        console.error('Error fetching connected apps for dock:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConnected();
  }, [enabled, tenantId, user]);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [apps, checkScroll]);

  // Don't render if disabled or no connected apps
  if (!enabled || loading || apps.length === 0) return null;

  const handleOpenApp = async (app: ConnectedApp) => {
    // Log usage
    if (tenantId && user) {
      await supabase.from('app_usage_logs').insert({
        tenant_id: tenantId,
        user_id: user.id,
        app_id: app.id,
        action_type: 'open',
      });

      // Update last_used_at
      await supabase
        .from('user_app_connections')
        .update({ last_used_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('app_id', app.id);
    }

    // Navigate to LYTA Tools workspace instead of opening external URL
    navigate('/crm/tools');
  };

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  return (
    <div className="relative mb-4">
      {/* Glass-morphism dock container */}
      <div className={cn(
        "relative flex items-center gap-1 px-2 py-2 rounded-2xl",
        "bg-card/80 backdrop-blur-xl border border-border/50",
        "shadow-[0_2px_20px_-4px_hsl(var(--foreground)/0.08)]",
        "dark:shadow-[0_2px_20px_-4px_hsl(var(--foreground)/0.15)]",
      )}>
        {/* Scroll left button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-muted/80 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}

        {/* Apps scroll area */}
        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {apps.map((app) => (
            <Tooltip key={app.id} delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleOpenApp(app)}
                  className={cn(
                    "flex-shrink-0 group relative",
                    "w-11 h-11 rounded-[13px] flex items-center justify-center",
                    "bg-muted/60 hover:bg-muted transition-all duration-200",
                    "hover:scale-110 hover:shadow-md active:scale-95",
                    "border border-transparent hover:border-border/50",
                  )}
                >
                  {app.logo_url ? (
                    <img
                      src={app.logo_url}
                      alt={app.name}
                      className="w-6 h-6 object-contain rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.querySelector('.fallback-icon')?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <Globe className={cn("w-5 h-5 text-muted-foreground fallback-icon", app.logo_url && "hidden")} />
                  
                  {/* Active indicator dot */}
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs font-medium">
                {app.name}
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Separator + Add button */}
          <div className="flex-shrink-0 w-px h-7 bg-border/50 mx-1" />
          
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/crm/tools')}
                className={cn(
                  "flex-shrink-0 w-11 h-11 rounded-[13px] flex items-center justify-center",
                  "border-2 border-dashed border-border/60 hover:border-primary/40",
                  "text-muted-foreground hover:text-primary",
                  "transition-all duration-200 hover:scale-105 active:scale-95",
                  "hover:bg-primary/5",
                )}
              >
                <Plus className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-medium">
              Ajouter une application
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Scroll right button */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-muted/80 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
