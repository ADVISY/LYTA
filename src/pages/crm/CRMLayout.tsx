import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
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
} from "lucide-react";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import advisyLogo from "@/assets/advisy-logo.svg";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
  { to: "/crm", icon: LayoutDashboard, label: "Dashboard", end: true, color: "from-blue-500 to-indigo-500" },
  { to: "/crm/clients", icon: Users, label: "Adresses", color: "from-emerald-500 to-teal-500" },
  { to: "/crm/contrats", icon: FileCheck, label: "Contrats", color: "from-violet-500 to-purple-500" },
  { to: "/crm/commissions", icon: DollarSign, label: "Commissions", color: "from-green-500 to-emerald-500" },
  { to: "/crm/compta", icon: FileText, label: "Compta", color: "from-amber-500 to-orange-500" },
  { to: "/crm/compagnies", icon: Building2, label: "Compagnies", color: "from-red-500 to-orange-500" },
  { to: "/crm/collaborateurs", icon: UserCog, label: "Collaborateurs", color: "from-pink-500 to-rose-500" },
  { to: "/crm/rapports", icon: BarChart3, label: "Rapports", color: "from-indigo-500 to-violet-500" },
  { to: "/crm/parametres", icon: Settings, label: "Paramètres", color: "from-slate-500 to-gray-500" },
];

export default function CRMLayout() {
  const { user, signOut } = useAuth();
  const { role, loading } = useUserRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-primary/20 to-slate-900">
        <div className="relative">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-primary/30 border-t-primary" />
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
        </div>
      </div>
    );
  }

  const NavItems = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="space-y-1.5">
      {menuItems.map((item, index) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onItemClick}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-500",
              "hover:translate-x-1 overflow-hidden",
              isActive
                ? "bg-gradient-to-r from-primary via-primary to-primary/80 text-white shadow-xl shadow-primary/30"
                : "hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent text-foreground/70 hover:text-foreground"
            )
          }
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {({ isActive }) => (
            <>
              {/* Glow effect on active */}
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-50" />
              )}
              
              {/* Icon with gradient background */}
              <div className={cn(
                "relative p-2 rounded-xl transition-all duration-300",
                isActive 
                  ? "bg-white/20" 
                  : `bg-gradient-to-br ${item.color} opacity-80 group-hover:opacity-100 group-hover:scale-110`
              )}>
                <item.icon className={cn(
                  "h-4 w-4 transition-all duration-300",
                  isActive ? "text-white" : "text-white"
                )} />
              </div>
              
              <span className="font-medium relative z-10">{item.label}</span>
              
              {/* Shine effect on hover */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </>
          )}
        </NavLink>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-primary/5">
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col bg-white/70 backdrop-blur-2xl border-r border-white/50 shadow-2xl shadow-primary/5 relative z-10">
        {/* Sidebar gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-violet-500/5 pointer-events-none" />
        
        {/* Logo Section */}
        <div className="p-6 border-b border-primary/10 relative">
          <div className="flex items-center justify-center">
            <img src={advisyLogo} alt="Advisy" className="h-16 object-contain" />
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs text-muted-foreground capitalize font-medium">
              {role} • en ligne
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto relative">
          <NavItems />
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-primary/10 relative">
          <div className="flex items-center gap-3 mb-4 p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-violet-500/5 border border-primary/10">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-violet-500/30 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">
                  {getUserInitials()}
                </span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{getUserDisplayName()}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full group rounded-xl border-red-200 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all duration-300"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-primary/10 shadow-lg">
        <div className="flex items-center justify-between p-4">
          <img src={advisyLogo} alt="Advisy" className="h-10 object-contain" />
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-primary/10 rounded-xl">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 bg-white/95 backdrop-blur-2xl">
              <div className="p-6 border-b border-primary/10 flex flex-col items-center">
                <img src={advisyLogo} alt="Advisy" className="h-14 object-contain" />
                <p className="text-xs text-muted-foreground capitalize mt-2">{role}</p>
              </div>
              <nav className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
                <NavItems onItemClick={() => setMobileMenuOpen(false)} />
              </nav>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary/10 bg-white/80">
                <p className="text-sm font-medium mb-4 truncate px-2">{getUserDisplayName()}</p>
                <Button
                  variant="outline"
                  className="w-full rounded-xl"
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
      <main className="flex-1 overflow-auto relative z-10">
        <div className="lg:p-8 p-4 pt-20 lg:pt-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
