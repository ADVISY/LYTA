import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  FileCheck,
  DollarSign,
  UserCog,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import advisyLogo from "@/assets/advisy-logo.svg";

const menuItems = [
  { to: "/crm", icon: LayoutDashboard, label: "Dashboard", end: true, color: "from-blue-500 to-indigo-500" },
  { to: "/crm/clients", icon: Users, label: "Adresses", color: "from-emerald-500 to-teal-500" },
  { to: "/crm/suivis", icon: ClipboardList, label: "Suivis", color: "from-amber-500 to-orange-500" },
  { to: "/crm/propositions", icon: FileText, label: "Propositions", color: "from-cyan-500 to-blue-500" },
  { to: "/crm/contrats", icon: FileCheck, label: "Contrats", color: "from-violet-500 to-purple-500" },
  { to: "/crm/commissions", icon: DollarSign, label: "Commissions", color: "from-green-500 to-emerald-500" },
  { to: "/crm/collaborateurs", icon: UserCog, label: "Collaborateurs", color: "from-pink-500 to-rose-500" },
  { to: "/crm/rapports", icon: BarChart3, label: "Rapports", color: "from-indigo-500 to-violet-500" },
  { to: "/crm/parametres", icon: Settings, label: "Paramètres", color: "from-slate-500 to-gray-500" },
];

export default function CRMLayout() {
  const { user, signOut } = useAuth();
  const { role, loading } = useUserRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-violet-600 rounded-2xl blur-lg opacity-50" />
              <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-xl">
                <img src={advisyLogo} alt="Advisy" className="w-7 h-7 brightness-0 invert" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary via-violet-600 to-primary bg-clip-text text-transparent">
                ADVISY CRM
              </h1>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs text-muted-foreground capitalize font-medium">
                  {role} • en ligne
                </p>
              </div>
            </div>
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
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.email}</p>
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg">
              <img src={advisyLogo} alt="Advisy" className="w-6 h-6 brightness-0 invert" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">ADVISY CRM</h1>
          </div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-primary/10 rounded-xl">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 bg-white/95 backdrop-blur-2xl">
              <div className="p-6 border-b border-primary/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg">
                    <img src={advisyLogo} alt="Advisy" className="w-7 h-7 brightness-0 invert" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">ADVISY CRM</h2>
                    <p className="text-xs text-muted-foreground capitalize">{role}</p>
                  </div>
                </div>
              </div>
              <nav className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
                <NavItems onItemClick={() => setMobileMenuOpen(false)} />
              </nav>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary/10 bg-white/80">
                <p className="text-sm font-medium mb-4 truncate px-2">{user?.email}</p>
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
