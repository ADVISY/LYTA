import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { usePolicies } from "@/hooks/usePolicies";
import { useCommissions } from "@/hooks/useCommissions";
import { useClients } from "@/hooks/useClients";
import { 
  TrendingUp, 
  ShieldCheck, 
  Wallet, 
  AlertCircle,
  DollarSign 
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export default function Dashboard() {
  const { user } = useAuth();
  const { policies, loading: policiesLoading } = usePolicies();
  const { commissions, loading: commissionsLoading } = useCommissions();
  const { clients, loading: clientsLoading } = useClients();

  const loading = policiesLoading || commissionsLoading || clientsLoading;

  // Calculate real stats from data
  const stats = {
    activeContracts: policies.filter(p => p.status === 'active').length,
    monthlyPremiums: policies
      .filter(p => p.status === 'active')
      .reduce((sum, p) => sum + (Number(p.premium_monthly) || 0), 0),
    ytdCommissions: commissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + Number(c.amount), 0),
    churnRate: policies.length > 0 
      ? ((policies.filter(p => p.status === 'cancelled').length / policies.length) * 100).toFixed(1)
      : 0
  };

  const premiumsData = [
    { month: 'Jan', montant: 3800 },
    { month: 'Fév', montant: 4100 },
    { month: 'Mar', montant: 3950 },
    { month: 'Avr', montant: 4200 },
    { month: 'Mai', montant: 4150 },
    { month: 'Juin', montant: 4250 },
  ];

  const categoryData = [
    { name: 'Santé', value: 5 },
    { name: 'Vie', value: 3 },
    { name: 'Auto', value: 2 },
    { name: 'Ménage', value: 1 },
    { name: '3e Pilier', value: 1 },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const kpiCards = [
    {
      title: "Contrats actifs",
      value: stats.activeContracts.toString(),
      icon: <ShieldCheck className="h-5 w-5" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      title: "Primes mensuelles",
      value: `CHF ${stats.monthlyPremiums.toFixed(2)}`,
      icon: <DollarSign className="h-5 w-5" />,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20"
    },
    {
      title: "Commissions YTD",
      value: `CHF ${stats.ytdCommissions.toFixed(2)}`,
      icon: <Wallet className="h-5 w-5" />,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
      title: "Taux de résiliation",
      value: `${stats.churnRate}%`,
      icon: <AlertCircle className="h-5 w-5" />,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-900/20"
    }
  ];

  return (
    <div className="space-y-4 h-full">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vue d'ensemble de vos performances
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            variants={fadeIn}
            initial="hidden"
            animate="show"
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div className={`${kpi.bgColor} ${kpi.color} p-1.5 rounded-lg`}>
                  {kpi.icon}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-xl font-bold">{kpi.value}</div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span>+12% vs mois dernier</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeIn} initial="hidden" animate="show">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Évolution des primes</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={premiumsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="montant" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Primes (CHF)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeIn} initial="hidden" animate="show">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Distribution par catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => 
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
