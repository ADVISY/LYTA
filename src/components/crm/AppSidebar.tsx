import { 
  LayoutDashboard, 
  FileText, 
  FolderOpen, 
  DollarSign, 
  Users, 
  Settings,
  LogOut,
  UserCircle,
  BarChart3
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import advisyLogo from "@/assets/advisy-logo.svg";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const partnerItems = [
  { title: "Dashboard", url: "/crm", icon: LayoutDashboard },
  { title: "Mes Clients", url: "/crm/clients", icon: Users },
  { title: "Mes Contrats", url: "/crm/contracts", icon: FileText },
  { title: "Documents", url: "/crm/documents", icon: FolderOpen },
  { title: "Commissions", url: "/crm/commissions", icon: DollarSign },
  { title: "Rapports", url: "/crm/reports", icon: BarChart3 },
];

const clientItems = [
  { title: "Dashboard", url: "/crm", icon: LayoutDashboard },
  { title: "Mes Contrats", url: "/crm/my-contracts", icon: FileText },
  { title: "Mes Documents", url: "/crm/my-documents", icon: FolderOpen },
  { title: "Mon Profil", url: "/crm/my-profile", icon: UserCircle },
];

const adminItems = [
  { title: "Dashboard", url: "/crm", icon: LayoutDashboard },
  { title: "Mes Clients", url: "/crm/clients", icon: Users },
  { title: "Mes Contrats", url: "/crm/contracts", icon: FileText },
  { title: "Documents", url: "/crm/documents", icon: FolderOpen },
  { title: "Commissions", url: "/crm/commissions", icon: DollarSign },
  { title: "Rapports", url: "/crm/reports", icon: BarChart3 },
];

const adminManagementItems = [
  { title: "Gestion Utilisateurs", url: "/admin/users", icon: UserCircle },
  { title: "Configuration", url: "/admin/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { role, isAdmin, isPartner, isClient } = useUserRole();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/crm") {
      return currentPath === path;
    }
    return currentPath.startsWith(path);
  };

  // Déterminer les items à afficher selon le rôle
  const menuItems = isAdmin ? adminItems : isPartner ? partnerItems : clientItems;
  const menuLabel = isAdmin ? "Espace Admin" : isPartner ? "Espace Partner" : "Espace Client";

  return (
    <Sidebar 
      className={collapsed ? "w-14" : "w-56"}
      collapsible="icon"
    >
      <SidebarContent>
        {/* Logo / Brand */}
        <div className="p-2 flex items-center justify-center">
          <img 
            src={advisyLogo} 
            alt="Advisy" 
            className={collapsed ? "h-8 w-8 object-contain" : "h-12 w-auto object-contain"}
          />
        </div>

        <Separator className="my-1" />

        {/* Main Navigation */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs uppercase tracking-wider">
              {menuLabel}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink 
                      to={item.url} 
                      end={item.url === "/crm"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors"
                      activeClassName="bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <>
            <Separator className="my-2" />

            {/* Admin Management Navigation */}
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-xs uppercase tracking-wider">
                  Administration
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminManagementItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild
                        tooltip={collapsed ? item.title : undefined}
                      >
                        <NavLink 
                          to={item.url}
                          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors"
                          activeClassName="bg-primary text-primary-foreground font-medium hover:bg-primary/90"
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* Footer with User Info */}
      <SidebarFooter className="p-2 border-t">
        {!collapsed && user && (
          <div className="mb-2 px-2">
            <p className="text-xs font-medium truncate">{user.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{role || 'Client'}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={signOut}
          className="w-full justify-start h-8"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Déconnexion</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
