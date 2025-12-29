import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Building2,
  Wand2,
  Settings,
  LogOut,
  Menu,
  Crown,
  ChevronLeft,
  ChevronRight,
  Users,
  Shield,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import lytaLogo from "@/assets/lyta-logo-full.svg";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
  { to: "/king", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/king/tenants", icon: Building2, label: "Clients SaaS" },
  { to: "/king/wizard", icon: Wand2, label: "Nouveau Client" },
  { to: "/king/users", icon: Users, label: "Utilisateurs" },
  { to: "/king/security", icon: Shield, label: "Sécurité" },
  { to: "/king/settings", icon: Settings, label: "Paramètres" },
];

export default function KingLayout() {
  const { user, signOut } = useAuth();
  const { role, loading, isKing } = useUserRole();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState<{ first_name: string | null; last_name: string | null } | null>(null);

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

  // Redirect non-KING users
  useEffect(() => {
    if (!loading && !isKing) {
      navigate('/connexion');
    }
  }, [loading, isKing, navigate]);

  const getUserDisplayName = () => {
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    return user?.email || 'KING LYTA';
  };

  const getUserInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase();
    }
    return 'K';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!isKing) {
    return null;
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
                  ? "bg-amber-500 text-white"
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
      {/* Desktop Sidebar */}
      <TooltipProvider>
        <aside className="hidden lg:flex flex-col bg-card border-r border-border">
          {/* Logo Section */}
          <div className="w-72 p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <img 
                src={lytaLogo} 
                alt="LYTA" 
                className="h-14 object-contain"
              />
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded-full">
                <Crown className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-500">KING</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <p className="text-xs text-muted-foreground">
                Super Admin Plateforme
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
              className="absolute -right-3 top-[140px] z-20 h-6 w-6 rounded-full border bg-white shadow-md hover:bg-amber-500 hover:text-white transition-all"
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
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center cursor-pointer">
                        <Crown className="h-5 w-5 text-amber-500" />
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
                  <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                        <Crown className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getUserDisplayName()}</p>
                      <p className="text-xs text-amber-600 font-semibold">KING LYTA</p>
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
          <div className="flex items-center gap-2">
            <img src={lytaLogo} alt="LYTA" className="h-10 object-contain" />
            <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded-full">
              <Crown className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-bold text-amber-500">KING</span>
            </div>
          </div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <div className="p-6 border-b border-border flex flex-col items-center">
                <img src={lytaLogo} alt="LYTA" className="h-14 object-contain" />
                <div className="flex items-center gap-1 px-3 py-1 bg-amber-500/10 rounded-full mt-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-bold text-amber-500">KING LYTA</span>
                </div>
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="lg:p-8 p-4 pt-20 lg:pt-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
