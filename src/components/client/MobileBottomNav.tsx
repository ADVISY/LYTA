import { NavLink, useLocation } from "react-router-dom";
import { 
  Home, 
  FileText, 
  FolderOpen, 
  MessageCircle, 
  User, 
  Bell,
  AlertTriangle,
  MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { useState } from "react";

const mainNavItems = [
  { to: "/espace-client", icon: Home, label: "Accueil", end: true },
  { to: "/espace-client/contrats", icon: FileText, label: "Contrats" },
  { to: "/espace-client/sinistres", icon: AlertTriangle, label: "Sinistres" },
  { to: "/espace-client/messages", icon: MessageCircle, label: "Messages" },
];

const moreNavItems = [
  { to: "/espace-client/documents", icon: FolderOpen, label: "Documents" },
  { to: "/espace-client/notifications", icon: Bell, label: "Notifications" },
  { to: "/espace-client/profil", icon: User, label: "Profil" },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = moreNavItems.some(item => 
    location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  );

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
      <nav className="flex items-center justify-around h-16 px-2">
        {mainNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all min-w-[64px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isActive && "bg-primary/10"
                )}>
                  <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* More menu */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all min-w-[64px]",
                isMoreActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-lg transition-colors",
                isMoreActive && "bg-primary/10"
              )}>
                <MoreHorizontal className={cn("h-5 w-5", isMoreActive && "stroke-[2.5]")} />
              </div>
              <span className="text-[10px] font-medium">Plus</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8">
            <div className="mx-auto w-12 h-1.5 rounded-full bg-muted mb-6 mt-2" />
            <div className="grid grid-cols-3 gap-4">
              {moreNavItems.map((item) => {
                const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
