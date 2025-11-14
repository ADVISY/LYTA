import { Outlet } from "react-router-dom";
import { Bell, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

export function CRMLayout() {
  const { user } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-12 border-b bg-white/80 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0 z-10">
            <SidebarTrigger />
            
            <div className="flex-1 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold">ADVISY CRM</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {user?.email}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="relative h-8 w-8">
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="h-full p-4">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
