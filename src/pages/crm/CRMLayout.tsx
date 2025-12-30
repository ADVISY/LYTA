import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  FileText,
  FileCheck,
  DollarSign,
  UserCog,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  Menu,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Mail,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import advisyLogo from "@/assets/advisy-logo.svg";
import { supabase } from "@/integrations/supabase/client";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WelcomeMessage } from "@/components/crm/WelcomeMessage";
import { UserAvatar } from "@/components/crm/UserAvatar";
import { SoundToggle } from "@/components/crm/SoundToggle";

const menuItems = [
  { to: "/crm", icon: LayoutDashboard, label: "Drive", end: true, color: "from-blue-500 to-indigo-500" },
  { to: "/crm/clients", icon: Users, label: "Adresses", color: "from-emerald-500 to-teal-500" },
  { to: "/crm/contrats", icon: FileCheck, label: "Contrats", color: "from-violet-500 to-purple-500" },
  { to: "/crm/commissions", icon: DollarSign, label: "Payout", color: "from-green-500 to-emerald-500" },
  { to: "/crm/compta", icon: FileText, label: "Finance", color: "from-amber-500 to-orange-500" },
  { to: "/crm/publicite", icon: Mail, label: "Publicité", color: "from-cyan-500 to-blue-500" },
  { to: "/crm/compagnies", icon: Building2, label: "Partners", color: "from-red-500 to-orange-500" },
  { to: "/crm/collaborateurs", icon: UserCog, label: "Team", color: "from-pink-500 to-rose-500" },
  { to: "/crm/rapports", icon: BarChart3, label: "Rapports", color: "from-indigo-500 to-violet-500" },
  { to: "/crm/parametres", icon: Settings, label: "Paramètres", color: "from-slate-500 to-gray-500" },
];

export default function CRMLayout() {
  const { user, signOut } = useAuth();
  const { role, loading } = useUserRole();
  const { tenant } = useTenant();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState<{ first_name: string | null; last_name: string | null } | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  // Check if we should show welcome message (on first load after login)
  useEffect(() => {
    const hasShownWelcome = sessionStorage.getItem('welcomeShown');
    if (!hasShownWelcome && user) {
      setShowWelcome(true);
      sessionStorage.setItem('welcomeShown', 'true');
    }
  }, [user]);

  // Get tenant logo or fallback to default
  const tenantLogo = tenant?.branding?.logo_url || advisyLogo;
  const tenantName = tenant?.branding?.display_name || tenant?.name || "Advisy";

  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .maybeSingle();
        if (data) setProfile(data);
      }
    };
    fetchProfile();
  }, [user?.id]);

  const getUserDisplayName = () => {
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    return user?.email || 'Utilisateur';
  };

  const getUserInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase();
    }
    if (profile?.first_name) {
      return profile.first_name.charAt(0).toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const NavItems = ({ onItemClick, collapsed = false }: { onItemClick?: () => void; collapsed?: boolean }) => (
    <div className="space-y-1">
      {menuItems.map((item) => {
        const linkContent = (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onItemClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg transition-colors",
                collapsed ? "px-3 py-2.5 justify-center" : "px-3 py-2.5",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </>
            )}
          </NavLink>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.to} delayDuration={0}>
              <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        }

        return linkContent;
      })}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Welcome Message */}
      {showWelcome && (
        <WelcomeMessage
          firstName={profile?.first_name}
          lastName={profile?.last_name}
          type="login"
          onClose={() => setShowWelcome(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <TooltipProvider>
        <aside className="hidden lg:flex flex-col bg-card border-r border-border">
          {/* Logo Section */}
          <div className="w-72 p-6 border-b border-border">
            <div className="flex items-center justify-between">
              {tenant?.branding?.logo_url ? (
                <img 
                  src={tenant.branding.logo_url} 
                  alt={tenantName} 
                  className="h-14 object-contain"
                />
              ) : (
                <img 
                  src={advisyLogo} 
                  alt="Advisy" 
                  className="h-14 object-contain"
                />
              )}
              <div className="flex items-center gap-1">
                <SoundToggle />
                <ThemeToggle />
              </div>
            </div>
            {tenant && (
              <div className="mt-2 px-2 py-1 bg-primary/10 rounded text-xs text-primary font-medium text-center">
                {tenantName}
              </div>
            )}
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-xs text-muted-foreground capitalize">
                {role} • en ligne
              </p>
            </div>
          </div>

          {/* Collapsible Navigation Section */}
          <div className={cn(
            "flex-1 flex flex-col transition-all duration-300",
            sidebarCollapsed ? "w-20" : "w-72"
          )}>
            {/* Collapse Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="absolute -right-3 top-[140px] z-20 h-6 w-6 rounded-full border bg-white shadow-md hover:bg-primary hover:text-white transition-all"
            >
              {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </Button>

            {/* Navigation */}
            <nav className={cn("flex-1 overflow-y-auto relative", sidebarCollapsed ? "p-2" : "p-4")}>
              <NavItems collapsed={sidebarCollapsed} />
            </nav>

            {/* User Section */}
            <div className={cn("border-t border-border", sidebarCollapsed ? "p-2" : "p-4")}>
              {sidebarCollapsed ? (
                <div className="flex flex-col items-center gap-2">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center cursor-pointer">
                        <span className="text-sm font-bold text-primary">{getUserInitials()}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">{getUserDisplayName()}</TooltipContent>
                  </Tooltip>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-lg hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => signOut()}
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Déconnexion</TooltipContent>
                  </Tooltip>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{getUserInitials()}</span>
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getUserDisplayName()}</p>
                      <p className="text-xs text-muted-foreground capitalize">{role}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => signOut()}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Déconnexion
                  </Button>
                </>
              )}
            </div>
          </div>
        </aside>
      </TooltipProvider>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          {tenant?.branding?.logo_url ? (
            <img src={tenant.branding.logo_url} alt={tenantName} className="h-10 object-contain" />
          ) : (
            <img src={advisyLogo} alt="Advisy" className="h-10 object-contain" />
          )}
          <div className="flex items-center gap-1">
            <SoundToggle />
            <ThemeToggle />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <div className="p-6 border-b border-border flex flex-col items-center">
                <img src={tenantLogo} alt={tenantName} className="h-14 object-contain" />
                <p className="text-sm font-medium mt-2">{tenantName}</p>
                <p className="text-xs text-muted-foreground capitalize">{role}</p>
              </div>
              <nav className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
                <NavItems onItemClick={() => setMobileMenuOpen(false)} />
              </nav>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
                <p className="text-sm font-medium mb-4 truncate px-2">{getUserDisplayName()}</p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => signOut()}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="lg:p-8 p-4 pt-20 lg:pt-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
