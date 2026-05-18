import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme } from "@/hooks/useTheme";
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
  FileCheck,
  Package,
  Handshake,
  AppWindow,
  DollarSign,
  Inbox,
  Activity,
  ChevronDown,
  UserCog,
} from "lucide-react";
import { useState, useEffect, Fragment } from "react";
import { useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { KingNotificationBell } from "@/components/king/KingNotificationsInbox";
import lytaLogo from "@/assets/lyta-logo-full.svg";

import { supabase } from "@/integrations/supabase/client";

// Structure menu hiérarchique : sections avec children pour sous-menus
// Items au top niveau : Dashboard, Onboarding (groupe), Support tickets,
// Référentiels, LYTA Tools, Paramètres (groupe)
type MenuItem = { to: string; icon: any; label: string; end?: boolean };
type MenuGroup = { label: string; icon: any; children: MenuItem[] };
type MenuEntry = MenuItem | MenuGroup;

const isGroup = (e: MenuEntry): e is MenuGroup => "children" in e;

const menuItems: MenuEntry[] = [
  { to: "/king", icon: LayoutDashboard, label: "Dashboard", end: true },
  {
    label: "Onboarding",
    icon: UserCog,
    children: [
      { to: "/king/tenants", icon: Building2, label: "Clients SaaS" },
      { to: "/king/wizard", icon: Wand2, label: "Nouveau Client" },
      { to: "/king/affiliates", icon: Handshake, label: "Affiliation" },
      { to: "/king/users", icon: Users, label: "Utilisateurs" },
    ],
  },
  { to: "/king/support", icon: Inbox, label: "Support tickets" },
  { to: "/king/catalog", icon: Package, label: "Référentiels" },
  { to: "/king/apps", icon: AppWindow, label: "LYTA Tools" },
  {
    label: "Paramètres",
    icon: Settings,
    children: [
      { to: "/king/plans", icon: Package, label: "Offres & Plans" },
      { to: "/king/costs", icon: DollarSign, label: "Coûts plateforme" },
      { to: "/king/monitoring", icon: Activity, label: "Monitoring" },
      { to: "/king/security", icon: Shield, label: "Sécurité" },
      { to: "/king/compliance", icon: FileCheck, label: "Conformité RGPD" },
      { to: "/king/settings", icon: Settings, label: "Paramètres généraux" },
    ],
  },
];

export default function KingLayout() {
  const { user, signOut } = useAuth();
  const { loading, isKing } = useUserRole();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState<{ first_name: string | null; last_name: string | null } | null>(null);
  const location = useLocation();
  // Auto-ouvrir le groupe contenant la route active
  const initialOpenGroups = () => {
    const set: Record<string, boolean> = {};
    menuItems.forEach(entry => {
      if (isGroup(entry)) {
        if (entry.children.some(c => location.pathname.startsWith(c.to))) {
          set[entry.label] = true;
        }
      }
    });
    return set;
  };
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpenGroups);

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

  const renderLink = (item: MenuItem, opts: { onItemClick?: () => void; collapsed: boolean; indent?: boolean }) => {
    const linkContent = (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={opts.onItemClick}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-lg transition-colors",
            opts.collapsed ? "px-3 py-2.5 justify-center" : "px-3 py-2.5",
            opts.indent && !opts.collapsed ? "ml-3 pl-5 border-l border-border/50" : "",
            isActive
              ? "bg-amber-500 text-white"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )
        }
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!opts.collapsed && <span className="text-sm font-medium">{item.label}</span>}
      </NavLink>
    );
    if (opts.collapsed) {
      return (
        <Tooltip key={item.to} delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return <Fragment key={item.to}>{linkContent}</Fragment>;
  };

  const NavItems = ({ onItemClick, collapsed = false }: { onItemClick?: () => void; collapsed?: boolean }) => (
    <div className="flex flex-col gap-1">
      {menuItems.map((entry, idx) => {
        if (!isGroup(entry)) {
          return renderLink(entry, { onItemClick, collapsed });
        }
        // Group avec sous-menu
        const isOpen = openGroups[entry.label] ?? false;
        const groupActive = entry.children.some(c => location.pathname.startsWith(c.to));

        if (collapsed) {
          // En mode collapsed : afficher chaque child séparément avec tooltip
          return (
            <Fragment key={entry.label}>
              <div className="px-3 py-1 mt-2 mb-0.5 text-center">
                <entry.icon className="h-3 w-3 mx-auto text-muted-foreground/50" />
              </div>
              {entry.children.map(c => renderLink(c, { onItemClick, collapsed: true }))}
            </Fragment>
          );
        }

        return (
          <Fragment key={entry.label}>
            <button
              type="button"
              onClick={() => setOpenGroups(o => ({ ...o, [entry.label]: !isOpen }))}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors w-full",
                groupActive
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <entry.icon className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium flex-1 text-left">{entry.label}</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="flex flex-col gap-1 mt-0.5 mb-1">
                {entry.children.map(c => renderLink(c, { onItemClick, collapsed: false, indent: true }))}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );

  return (
    <div
      className="h-screen flex bg-background overflow-hidden"
      style={{
        backgroundImage: "url('/images/bg-pattern-gray.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed"
      }}
    >
      {/* Desktop Sidebar */}
      <TooltipProvider>
        <aside className={cn(
          "hidden lg:flex flex-col h-screen sticky top-0 bg-card border-r border-border relative transition-all duration-300",
          sidebarCollapsed ? "w-20" : "w-72"
        )}>
          {/* Collapse Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-[140px] z-20 h-6 w-6 rounded-full border bg-card shadow-md hover:bg-amber-500 hover:text-white transition-all"
          >
            {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </Button>

          {/* Logo Section */}
          <div className="p-6 border-b border-border overflow-hidden">
            <div className="flex flex-col items-center">
              <img
                src={lytaLogo}
                alt="LYTA"
                className={cn("object-contain transition-all duration-300", sidebarCollapsed ? "h-8" : "h-14")}
              />
            </div>
            {!sidebarCollapsed && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <p className="text-xs text-muted-foreground">
                  Super Admin Plateforme
                </p>
              </div>
            )}
          </div>

          {/* Navigation Section */}
          <div className="flex-1 flex flex-col overflow-hidden">

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
                    <KingNotificationBell />
                    <ThemeToggle />
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
          <div className="flex items-center gap-1">
            <KingNotificationBell />
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
      </div>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 overflow-y-auto relative",
          theme === "dark" && "bg-background"
        )}
      >
        {/* Dark mode overlay */}
        {theme === "dark" && (
          <div
            className="absolute inset-0 bg-background/80 pointer-events-none"
          />
        )}
        <div className="lg:p-8 p-4 pt-20 lg:pt-8 max-w-7xl mx-auto relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
