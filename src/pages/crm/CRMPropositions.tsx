import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Send, FileClock, FileCheck, FileX } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CRMPropositions() {
  const { t } = useTranslation();

  const statsCards = [
    { label: t('propositions.drafts'), value: "3", icon: FileClock, color: "from-slate-500 to-gray-600" },
    { label: t('propositions.sent'), value: "12", icon: Send, color: "from-blue-500 to-indigo-600" },
    { label: t('propositions.accepted'), value: "8", icon: FileCheck, color: "from-emerald-500 to-teal-600" },
    { label: t('propositions.rejected'), value: "2", icon: FileX, color: "from-red-500 to-rose-600" },
  ];

  return (
    <div className="space-y-8">
      {/* Header with decorative background */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent rounded-3xl blur-2xl" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl blur-lg opacity-50" />
              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-xl">
                <FileText className="h-7 w-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {t('propositions.title')}
              </h1>
              <p className="text-muted-foreground">{t('propositions.subtitle')}</p>
            </div>
          </div>
          <Button className="group bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-xl shadow-primary/20 rounded-xl">
            <Plus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90 duration-300" />
            {t('propositions.newProposition')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {statsCards.map((stat, index) => (
          <Card 
            key={stat.label} 
            className="group border-0 shadow-lg bg-white/80 backdrop-blur hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={cn(
              "absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-10 blur-2xl bg-gradient-to-br",
              stat.color
            )} />
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <CardContent className="p-5 relative">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "p-2.5 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
                  stat.color
                )}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coming Soon Card */}
      <Card className="relative border-0 shadow-xl overflow-hidden bg-gradient-to-br from-cyan-500/5 via-blue-500/5 to-cyan-500/5">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDYsMTgyLDIxMiwwLjEpIiBzdHJva2Utd2lkdGg9IjIiLz48L2c+PC9zdmc+')] opacity-30" />
        
        <CardContent className="relative flex flex-col items-center justify-center py-16">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-3xl blur-2xl opacity-30 animate-pulse" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 flex items-center justify-center">
              <FileText className="h-12 w-12 text-cyan-600" />
            </div>
          </div>
          <p className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
            {t('propositions.moduleInConstruction')}
          </p>
          <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
            {t('propositions.comingSoonDesc')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
