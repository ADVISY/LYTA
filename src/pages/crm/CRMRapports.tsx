import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, TrendingUp, PieChart, LineChart, Download, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const reportTypes = [
  { label: "Performance", icon: TrendingUp, color: "from-emerald-500 to-teal-600", description: "Analyse des performances" },
  { label: "Ventes", icon: BarChart3, color: "from-blue-500 to-indigo-600", description: "Rapport des ventes" },
  { label: "Distribution", icon: PieChart, color: "from-amber-500 to-orange-600", description: "Répartition par produit" },
  { label: "Tendances", icon: LineChart, color: "from-violet-500 to-purple-600", description: "Évolution temporelle" },
];

export default function CRMRapports() {
  return (
    <div className="space-y-8">
      {/* Header with decorative background */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent rounded-3xl blur-2xl" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl blur-lg opacity-50" />
              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl">
                <BarChart3 className="h-7 w-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Rapports
              </h1>
              <p className="text-muted-foreground">Analyses et statistiques de votre activité</p>
            </div>
          </div>
          <Button variant="outline" className="gap-2 rounded-xl border-primary/20 hover:bg-primary/5">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Report Types Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {reportTypes.map((report, index) => (
          <Card 
            key={report.label} 
            className="group border-0 shadow-lg bg-white/80 backdrop-blur hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 cursor-pointer overflow-hidden"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={cn(
              "absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-10 blur-2xl bg-gradient-to-br group-hover:opacity-20 transition-opacity",
              report.color
            )} />
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "p-3 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
                  report.color
                )}>
                  <report.icon className="h-6 w-6 text-white" />
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="font-semibold text-lg group-hover:text-primary transition-colors">{report.label}</p>
              <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coming Soon Card */}
      <Card className="relative border-0 shadow-xl overflow-hidden bg-gradient-to-br from-indigo-500/5 via-violet-500/5 to-indigo-500/5">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDk5LDEwMiwyNDEsMC4xKSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
        
        <CardContent className="relative flex flex-col items-center justify-center py-16">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl blur-2xl opacity-30 animate-pulse" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-violet-600/10 border border-indigo-500/20 flex items-center justify-center">
              <BarChart3 className="h-12 w-12 text-indigo-600" />
            </div>
          </div>
          <p className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            Rapports détaillés
          </p>
          <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
            Les analyses avancées et rapports personnalisables seront bientôt disponibles
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
