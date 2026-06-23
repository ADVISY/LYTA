/**
 * CRMPortefeuille — Page hub qui regroupe Contrats + Commissions + Compta.
 *
 * Allègement du menu CRM : au lieu de 3 entrées séparées dans le menu, on a
 * une seule entrée "Portefeuille" qui ouvre cette page hub avec 3 cartes
 * cliquables vers chaque sous-module.
 *
 * Les routes /crm/contrats, /crm/commissions, /crm/compta restent
 * fonctionnelles (utilisées en interne et par les liens directs).
 */
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import {
  Briefcase,
  FileCheck,
  DollarSign,
  FileText,
  ArrowRight,
} from "lucide-react";
import { usePolicies } from "@/hooks/usePolicies";
import { useCommissions } from "@/hooks/useCommissions";

export default function CRMPortefeuille() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { policies = [], loading: policiesLoading } = usePolicies();
  const { commissions = [], loading: commissionsLoading } = useCommissions();

  const activePoliciesCount = policies.filter((p: any) => p.status === "active").length;
  const totalCommissionsCount = commissions.length;

  const sections = [
    {
      id: "contrats",
      title: t("contracts.title", "Contrats"),
      description: "Toutes les polices d'assurance gérées",
      stat: policiesLoading ? "..." : `${activePoliciesCount} actifs`,
      icon: FileCheck,
      color: "from-violet-500 to-purple-600",
      bgColor: "from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20",
      borderColor: "border-violet-200 dark:border-violet-800",
      route: "/crm/contrats",
    },
    {
      id: "commissions",
      title: "Commissions",
      description: "Suivi des commissions par compagnie et par contrat",
      stat: commissionsLoading ? "..." : `${totalCommissionsCount} lignes`,
      icon: DollarSign,
      color: "from-green-500 to-emerald-600",
      bgColor: "from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20",
      borderColor: "border-green-200 dark:border-green-800",
      route: "/crm/commissions",
    },
    {
      id: "compta",
      title: t("finance.title", "Comptabilité"),
      description: "Décomptes de commissions et rapprochement",
      stat: "—",
      icon: FileText,
      color: "from-amber-500 to-orange-600",
      bgColor: "from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20",
      borderColor: "border-amber-200 dark:border-amber-800",
      route: "/crm/compta",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl blur-lg opacity-50" />
          <div className="relative p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl">
            <Briefcase className="h-7 w-7 text-white" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Portefeuille
          </h1>
          <p className="text-muted-foreground">
            Vue d'ensemble des polices, commissions et comptabilité du cabinet
          </p>
        </div>
      </div>

      {/* Cartes des sous-modules */}
      <div className="grid gap-6 md:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Card
              key={section.id}
              className={`cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 border-2 ${section.borderColor} bg-gradient-to-br ${section.bgColor}`}
              onClick={() => navigate(section.route)}
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-br ${section.color} text-white shadow-lg`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">{section.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {section.description}
                  </p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {section.stat}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
