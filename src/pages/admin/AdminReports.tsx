import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Filter, TrendingUp, Users, DollarSign } from "lucide-react";
import { usePolicies } from "@/hooks/usePolicies";
import { useClients } from "@/hooks/useClients";
import { useCommissions } from "@/hooks/useCommissions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  pending: "bg-yellow-500",
  cancelled: "bg-red-500",
  expired: "bg-gray-500",
};

const statusLabels: Record<string, string> = {
  active: "Actif",
  pending: "En attente",
  cancelled: "Annulé",
  expired: "Expiré",
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function AdminReports() {
  const { policies, loading: policiesLoading } = usePolicies();
  const { clients, loading: clientsLoading } = useClients();
  const { commissions, loading: commissionsLoading } = useCommissions();

  const [filters, setFilters] = useState({
    status: "all",
    company: "all",
    startDate: "",
    endDate: "",
    year: "all",
    month: "all",
    searchTerm: "",
  });

  const loading = policiesLoading || clientsLoading || commissionsLoading;

  // Get unique companies
  const companies = useMemo(() => {
    const uniqueCompanies = new Set<string>();
    policies.forEach((policy) => {
      if (policy.product?.company?.name) {
        uniqueCompanies.add(policy.product.company.name);
      }
    });
    return Array.from(uniqueCompanies).sort();
  }, [policies]);

  // Filter data
  const filteredData = useMemo(() => {
    return policies.filter((policy) => {
      if (filters.status !== "all" && policy.status !== filters.status) {
        return false;
      }
      if (filters.company !== "all" && policy.product?.company?.name !== filters.company) {
        return false;
      }
      if (filters.startDate && policy.start_date < filters.startDate) {
        return false;
      }
      if (filters.endDate && policy.start_date > filters.endDate) {
        return false;
      }
      if (filters.year && filters.year !== "all") {
        const policyYear = new Date(policy.start_date).getFullYear().toString();
        if (policyYear !== filters.year) {
          return false;
        }
      }
      if (filters.month && filters.month !== "all") {
        const policyMonth = (new Date(policy.start_date).getMonth() + 1).toString();
        if (policyMonth !== filters.month) {
          return false;
        }
      }
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const clientName = policy.client?.profile?.first_name || policy.client?.company_name || "";
        const policyNumber = policy.policy_number || "";
        const productName = policy.product?.name || "";
        
        if (
          !clientName.toLowerCase().includes(searchLower) &&
          !policyNumber.toLowerCase().includes(searchLower) &&
          !productName.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [policies, filters]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalPremiumMonthly = filteredData.reduce(
      (sum, p) => sum + (p.premium_monthly || 0),
      0
    );
    const totalPremiumYearly = filteredData.reduce(
      (sum, p) => sum + (p.premium_yearly || 0),
      0
    );
    const totalCommissions = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);

    return {
      totalPolicies: filteredData.length,
      totalClients: clients.length,
      totalPremiumMonthly,
      totalPremiumYearly,
      totalCommissions,
      activePolicies: filteredData.filter((p) => p.status === "active").length,
      pendingPolicies: filteredData.filter((p) => p.status === "pending").length,
    };
  }, [filteredData, clients, commissions]);

  // Company distribution
  const companyDistribution = useMemo(() => {
    const distribution = new Map<string, number>();
    filteredData.forEach((policy) => {
      const company = policy.product?.company?.name || "Inconnu";
      distribution.set(company, (distribution.get(company) || 0) + 1);
    });
    return Array.from(distribution.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [filteredData]);

  // Monthly evolution
  const monthlyEvolution = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: format(new Date(2024, i), "MMM", { locale: fr }),
      contracts: 0,
      premium: 0,
    }));

    filteredData.forEach((policy) => {
      const monthIndex = new Date(policy.start_date).getMonth();
      months[monthIndex].contracts += 1;
      months[monthIndex].premium += policy.premium_monthly || 0;
    });

    return months;
  }, [filteredData]);

  const handleExport = () => {
    const csvContent = [
      ["N° Police", "Client", "Produit", "Compagnie", "Statut", "Date début", "Prime mensuelle"],
      ...filteredData.map((p) => [
        p.policy_number || "",
        p.client?.profile?.first_name || p.client?.company_name || "",
        p.product?.name || "",
        p.product?.company?.name || "",
        statusLabels[p.status] || p.status,
        format(new Date(p.start_date), "dd/MM/yyyy"),
        p.premium_monthly?.toString() || "0",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport_global_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Rapports Globaux</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Vue d'ensemble et statistiques de toute l'activité
            </p>
          </div>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Contrats totaux
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPolicies}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activePolicies} actifs, {stats.pendingPolicies} en attente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Clients totaux
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Primes mensuelles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                CHF {stats.totalPremiumMonthly.toLocaleString("fr-CH")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Commissions totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                CHF {stats.totalCommissions.toLocaleString("fr-CH")}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Évolution mensuelle</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyEvolution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="contracts" fill="hsl(var(--primary))" name="Contrats" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Répartition par compagnie</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={companyDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {companyDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label>Recherche</Label>
                <Input
                  placeholder="Client, N° police..."
                  value={filters.searchTerm}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, searchTerm: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Statut</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters((f) => ({ ...f, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                    <SelectItem value="expired">Expiré</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Compagnie</Label>
                <Select
                  value={filters.company}
                  onValueChange={(value) =>
                    setFilters((f) => ({ ...f, company: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company} value={company}>
                        {company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Année</Label>
                <Select
                  value={filters.year}
                  onValueChange={(value) =>
                    setFilters((f) => ({ ...f, year: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Détail des contrats ({filteredData.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Police</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Compagnie</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date début</TableHead>
                  <TableHead className="text-right">Prime/mois</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">
                      {policy.policy_number || "N/A"}
                    </TableCell>
                    <TableCell>
                      {policy.client?.profile?.first_name ||
                        policy.client?.company_name ||
                        "N/A"}
                    </TableCell>
                    <TableCell>{policy.product?.name || "N/A"}</TableCell>
                    <TableCell>{policy.product?.company?.name || "N/A"}</TableCell>
                    <TableCell>
                      <Badge
                        className={statusColors[policy.status]}
                        variant="secondary"
                      >
                        {statusLabels[policy.status] || policy.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(policy.start_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      CHF {policy.premium_monthly?.toLocaleString("fr-CH") || "0"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
