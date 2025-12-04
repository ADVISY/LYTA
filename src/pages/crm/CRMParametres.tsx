import { Card, CardContent } from "@/components/ui/card";
import { Settings, User, Bell, Shield, Palette, Database, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const settingsSections = [
  { label: "Profil", icon: User, color: "from-blue-500 to-indigo-600", bgColor: "from-blue-500/20 to-indigo-600/10", description: "Informations personnelles" },
  { label: "Notifications", icon: Bell, color: "from-amber-500 to-orange-600", bgColor: "from-amber-500/20 to-orange-600/10", description: "Préférences d'alertes" },
  { label: "Sécurité", icon: Shield, color: "from-emerald-500 to-teal-600", bgColor: "from-emerald-500/20 to-teal-600/10", description: "Mot de passe et 2FA" },
  { label: "Apparence", icon: Palette, color: "from-violet-500 to-purple-600", bgColor: "from-violet-500/20 to-purple-600/10", description: "Thème et affichage" },
  { label: "Données", icon: Database, color: "from-slate-500 to-gray-600", bgColor: "from-slate-500/20 to-gray-600/10", description: "Export et import" },
];

export default function CRMParametres() {
  return (
    <div className="space-y-8">
      {/* Header with decorative background */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-slate-500/10 via-gray-500/5 to-transparent rounded-3xl blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-500 to-gray-600 rounded-2xl blur-lg opacity-50" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-500 to-gray-600 shadow-xl">
              <Settings className="h-7 w-7 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Paramètres
            </h1>
            <p className="text-muted-foreground">Configurez votre CRM selon vos besoins</p>
          </div>
        </div>
      </div>

      {/* Settings Sections Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {settingsSections.map((section, index) => (
          <Card 
            key={section.label} 
            className={cn(
              "group relative border-0 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer overflow-hidden",
              "hover:-translate-y-2 hover:scale-[1.02]",
              "bg-white/80 backdrop-blur-sm"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Gradient background on hover */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
              section.bgColor
            )} />
            
            {/* Shine effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-br rounded-xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity",
                      section.color
                    )} />
                    <div className={cn(
                      "relative p-3 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
                      section.color
                    )}>
                      <section.icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-lg group-hover:text-primary transition-colors">{section.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Premium Feature Card */}
      <Card className="relative border-0 shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 via-violet-500/5 to-primary/5">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDEwMCw1MCwyNTUsMC4xKSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
        
        <CardContent className="relative flex flex-col items-center justify-center py-16">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-violet-600 rounded-3xl blur-2xl opacity-30 animate-pulse" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-violet-600/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="h-12 w-12 text-primary" />
            </div>
          </div>
          <p className="text-xl font-bold bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
            Configuration avancée
          </p>
          <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
            Les paramètres détaillés et options de personnalisation avancées seront bientôt disponibles
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
