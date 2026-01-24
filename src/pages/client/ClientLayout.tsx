import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation, NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { MouseGradient } from "@/components/ui/mouse-gradient";
import { 
  Home, 
  FileText, 
  FolderOpen, 
  MessageCircle, 
  User, 
  Bell,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";

const menuItems = [
  { to: "/espace-client", icon: Home, label: "Accueil", end: true },
  { to: "/espace-client/contrats", icon: FileText, label: "Mes contrats" },
  { to: "/espace-client/documents", icon: FolderOpen, label: "Mes documents" },
  { to: "/espace-client/sinistres", icon: AlertTriangle, label: "Sinistres" },
  { to: "/espace-client/messages", icon: MessageCircle, label: "Messages" },
  { to: "/espace-client/notifications", icon: Bell, label: "Notifications" },
  { to: "/espace-client/profil", icon: User, label: "Mon profil" },
];

export default function ClientLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { tenant } = useTenant();
  const [user, setUser] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [advisorData, setAdvisorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Get tenant branding
  const tenantLogo = tenant?.branding?.logo_url;
  const tenantName = tenant?.branding?.display_name || tenant?.name || "Cabinet";

  // Set page title for Client space
  useEffect(() => {
    document.title = `${tenantName} - Espace Client`;
  }, [tenantName]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/connexion");
        return;
      }
      
      setUser(session.user);
      
      // Check user roles (user can have multiple roles)
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);

      const roles = (rolesData ?? []).map((r) => r.role as string);
      const hasClientRole = roles.includes('client');

      // Check if user has a client record (needed for client portal)
      const { data: clientRecord } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      // If user has no client role/record, they should not be here
      if (!hasClientRole && !clientRecord) {
        navigate("/crm", { replace: true });
        return;
      }
      
      if (clientRecord) {
        setClientData(clientRecord);
        
        // Fetch assigned advisor info via secure RPC function
        // Note: depending on backend/client typing, `data` may be an array or a single object.
        const { data: advisorDataRpc, error: advisorError } =
          await supabase.rpc("get_assigned_advisor_public");

        if (advisorError) {
          console.error("Failed to load assigned advisor", advisorError);
        } else {
          const advisor = Array.isArray(advisorDataRpc)
            ? advisorDataRpc[0]
            : advisorDataRpc;
          if (advisor && (advisor as any).id) {
            setAdvisorData(advisor);
          }
        }
      }
      
      setLoading(false);
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate("/connexion");
      }
    });
    
    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log("Logout completed (session may have been expired)");
    }
    toast({
      title: "Déconnexion",
      description: "Vous avez été déconnecté avec succès",
    });
    navigate("/connexion");
  };

  const getInitials = () => {
    if (clientData) {
      return `${clientData.first_name?.[0] || ''}${clientData.last_name?.[0] || ''}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || 'C';
  };

  const getDisplayName = () => {
    if (clientData) {
      return `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim();
    }
    return user?.email || 'Client';
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

        return <div key={item.to}>{linkContent}</div>;
      })}
    </div>
  );

  // Get tenant primary color for gradient
  const gradientColor = tenant?.branding?.primary_color || "#D4A418";

  return (
    <MouseGradient
      className="min-h-screen flex bg-background"
      gradientColor={gradientColor}
      gradientSize={1200}
      intensity={0.3}
      alwaysVisible={true}
    >
      {/* Desktop Sidebar */}
      <TooltipProvider>
        <aside className="hidden lg:flex flex-col bg-card border-r border-border">
          {/* Logo Section */}
          <div className="w-72 p-6 border-b border-border">
            <div className="flex items-center justify-between">
              {tenantLogo ? (
                <img 
                  src={tenantLogo} 
                  alt={tenantName} 
                  className="h-14 object-contain"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Building2 className="h-8 w-8 text-primary" />
                  <span className="text-xl font-bold">{tenantName}</span>
                </div>
              )}
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-xs text-muted-foreground">
                Espace Client • en ligne
              </p>
            </div>
            
            {/* Advisor Info */}
            {advisorData && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 text-center">Votre conseiller</p>
                <div className="flex items-center gap-3">
                  {advisorData.photo_url ? (
                    <img 
                      src={advisorData.photo_url} 
                      alt={`${advisorData.first_name} ${advisorData.last_name}`}
                      className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {advisorData.first_name} {advisorData.last_name}
                    </p>
                    {(advisorData.phone || advisorData.mobile) && (
                      <a 
                        href={`tel:${advisorData.mobile || advisorData.phone}`}
                        className="text-xs text-muted-foreground hover:text-primary truncate block"
                      >
                        {advisorData.mobile || advisorData.phone}
                      </a>
                    )}
                    {advisorData.email && (
                      <a 
                        href={`mailto:${advisorData.email}`}
                        className="text-xs text-primary hover:underline truncate block"
                      >
                        {advisorData.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
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
                        <span className="text-sm font-bold text-primary">{getInitials()}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">{getDisplayName()}</TooltipContent>
                  </Tooltip>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-lg hover:bg-destructive hover:text-destructive-foreground"
                        onClick={handleLogout}
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
                        <span className="text-sm font-bold text-primary">{getInitials()}</span>
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getDisplayName()}</p>
                      <p className="text-xs text-muted-foreground">Client</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleLogout}
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
          {tenantLogo ? (
            <img src={tenantLogo} alt={tenantName} className="h-10 object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="font-bold">{tenantName}</span>
            </div>
          )}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <div className="p-6 border-b border-border flex flex-col items-center">
                {tenantLogo ? (
                  <img src={tenantLogo} alt={tenantName} className="h-14 object-contain" />
                ) : (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-8 w-8 text-primary" />
                    <span className="text-xl font-bold">{tenantName}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Espace Client</p>
                
                {/* Mobile Advisor Info */}
                {advisorData && (
                  <div className="mt-4 pt-4 border-t border-border w-full">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 text-center">Votre conseiller</p>
                    <div className="flex items-center gap-3">
                      {advisorData.photo_url ? (
                        <img 
                          src={advisorData.photo_url} 
                          alt={`${advisorData.first_name} ${advisorData.last_name}`}
                          className="w-10 h-10 rounded-full object-cover border-2 border-primary/20"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-medium text-sm truncate">
                          {advisorData.first_name} {advisorData.last_name}
                        </p>
                        {(advisorData.phone || advisorData.mobile) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {advisorData.mobile || advisorData.phone}
                          </p>
                        )}
                        {advisorData.email && (
                          <p className="text-xs text-primary truncate">{advisorData.email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <nav className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
                <NavItems onItemClick={() => setMobileMenuOpen(false)} />
              </nav>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
                <p className="text-sm font-medium mb-4 truncate px-2">{getDisplayName()}</p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleLogout}
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
          <Outlet context={{ user, clientData, advisorData }} />
        </div>
      </main>
    </MouseGradient>
  );
}
