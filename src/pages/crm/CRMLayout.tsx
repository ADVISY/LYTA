import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, FileText, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function CRMLayout() {
  const { user, signOut } = useAuth();
  const { role, loading } = useUserRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const navItems = [
    { to: "/crm", icon: LayoutDashboard, label: "Dashboard", end: true },
    { to: "/crm/clients", icon: Users, label: "Clients" },
    { to: "/crm/contracts", icon: FileText, label: "Contrats" },
  ];

  const NavItems = () => (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setMobileMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`
          }
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold">ADVISY CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">{role}</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItems />
        </nav>

        <div className="p-4 border-t">
          <div className="mb-4">
            <p className="text-sm font-medium truncate">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold">ADVISY CRM</h1>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold">ADVISY CRM</h2>
                <p className="text-sm text-muted-foreground mt-1">{role}</p>
              </div>
              <nav className="p-4 space-y-2">
                <NavItems />
              </nav>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
                <p className="text-sm font-medium mb-4 truncate">{user?.email}</p>
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
        <div className="lg:p-8 p-4 pt-20 lg:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
