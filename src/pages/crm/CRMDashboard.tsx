import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Users, FileText, DollarSign, TrendingUp, ArrowUpRight, Sparkles, Clock, FileCheck, Bell, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const kpiCards = [
  {
    title: "Clients",
    value: "124",
    change: "+12%",
    description: "Total clients actifs",
    icon: Users,
    gradient: "from-blue-500 to-indigo-600",
    glowColor: "blue",
  },
  {
    title: "Contrats",
    value: "89",
    change: "+8%",
    description: "Contrats en cours",
    icon: FileText,
    gradient: "from-emerald-500 to-teal-600",
    glowColor: "emerald",
  },
  {
    title: "Commissions",
    value: "12'450 CHF",
    change: "+23%",
    description: "Ce mois",
    icon: DollarSign,
    gradient: "from-amber-500 to-orange-600",
    glowColor: "amber",
    roles: ["admin", "partner"],
  },
  {
    title: "Revenus",
    value: "45'890 CHF",
    change: "+15%",
    description: "Primes mensuelles",
    icon: TrendingUp,
    gradient: "from-violet-500 to-purple-600",
    glowColor: "violet",
    roles: ["admin", "partner"],
  },
];

const recentActivities = [
  { icon: FileCheck, text: "Nouveau contrat signé", time: "Il y a 2h", color: "from-emerald-500 to-teal-600" },
  { icon: Users, text: "Client ajouté", time: "Il y a 4h", color: "from-blue-500 to-indigo-600" },
  { icon: Bell, text: "Rappel de suivi", time: "Il y a 6h", color: "from-amber-500 to-orange-600" },
];

const todoItems = [
  { label: "Contrats à renouveler", count: 5, color: "from-red-500 to-rose-600" },
  { label: "Suivis en attente", count: 12, color: "from-amber-500 to-orange-600" },
  { label: "Documents à valider", count: 3, color: "from-blue-500 to-indigo-600" },
];

export default function CRMDashboard() {
  const { role, isAdmin, isPartner, isClient } = useUserRole();

  const visibleCards = kpiCards.filter(
    (card) => !card.roles || card.roles.includes(role || "")
  );

  return (
    <div className="space-y-8">
      {/* Header with decorative background */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 via-violet-500/5 to-transparent rounded-3xl blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-violet-600 rounded-2xl blur-lg opacity-50" />
                <div className="relative p-3 rounded-2xl bg-gradient-to-br from-primary to-violet-600 shadow-xl">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                  Tableau de bord
                </h1>
                <p className="text-muted-foreground">
                  {isAdmin && "Vue d'ensemble administrative"}
                  {isPartner && "Vue d'ensemble partenaire"}
                  {isClient && "Aperçu de vos contrats"}
                </p>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur border border-primary/10 shadow-lg">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {visibleCards.map((card, index) => (
          <Card
            key={card.title}
            className={cn(
              "group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500",
              "hover:-translate-y-2 cursor-pointer bg-white/80 backdrop-blur"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Decorative gradient orbs */}
            <div className={cn(
              "absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-20 blur-3xl transition-all duration-700",
              `bg-gradient-to-br ${card.gradient}`,
              "group-hover:opacity-40 group-hover:scale-150"
            )} />
            <div className={cn(
              "absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-10 blur-2xl",
              `bg-gradient-to-br ${card.gradient}`
            )} />
            
            {/* Shine effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between mb-5">
                <div className="relative">
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br rounded-xl blur-lg opacity-50 group-hover:opacity-70",
                    card.gradient
                  )} />
                  <div className={cn(
                    "relative p-3 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
                    card.gradient
                  )}>
                    <card.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                  <ArrowUpRight className="h-3 w-3" />
                  {card.change}
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="text-3xl font-bold tracking-tight">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Activité récente</h3>
              <span className="text-xs text-primary font-medium cursor-pointer hover:underline">Voir tout</span>
            </div>
            <div className="space-y-4">
              {recentActivities.map((activity, i) => (
                <div 
                  key={i} 
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-muted/50 to-transparent hover:from-primary/5 hover:to-transparent transition-all duration-300 cursor-pointer"
                >
                  <div className={cn(
                    "p-2.5 rounded-xl bg-gradient-to-br shadow-md group-hover:scale-110 transition-transform",
                    activity.color
                  )}>
                    <activity.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{activity.text}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* To Do */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">À faire</h3>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                {todoItems.reduce((acc, item) => acc + item.count, 0)} total
              </span>
            </div>
            <div className="space-y-4">
              {todoItems.map((item, i) => (
                <div 
                  key={i}
                  className="group flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-muted/50 to-transparent hover:from-primary/5 hover:to-transparent transition-all duration-300 cursor-pointer"
                >
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-3 py-1.5 rounded-full text-white text-sm font-bold shadow-md bg-gradient-to-r",
                      item.color
                    )}>
                      {item.count}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
