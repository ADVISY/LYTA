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
          <header className="h-16 border-b bg-white/80 backdrop-blur-sm flex items-center px-6 gap-4 shrink-0 z-10">
            <SidebarTrigger />
            
            <div className="flex-1 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">ADVISY CRM</h1>
                <p className="text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
                </Button>
                <Button variant="ghost" size="icon">
                  <Search className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
