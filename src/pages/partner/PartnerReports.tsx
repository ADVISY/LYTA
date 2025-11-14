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

export default function PartnerReports() {
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
      // Status filter
      if (filters.status !== "all" && policy.status !== filters.status) {
        return false;
      }

      // Company filter
      if (filters.company !== "all" && policy.product?.company?.name !== filters.company) {
        return false;
      }

      // Date range filter
      if (filters.startDate && policy.start_date < filters.startDate) {
        return false;
      }
      if (filters.endDate && policy.start_date > filters.endDate) {
        return false;
      }

      // Year filter
      if (filters.year && filters.year !== "all") {
        const policyYear = new Date(policy.start_date).getFullYear().toString();
        if (policyYear !== filters.year) {
          return false;
        }
      }

      // Month filter
      if (filters.month && filters.month !== "all") {
        const policyMonth = (new Date(policy.start_date).getMonth() + 1).toString();
        if (policyMonth !== filters.month) {
          return false;
        }
      }

      // Search term
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
    const totalContracts = filteredData.length;
    const totalPremiums = filteredData.reduce(
      (sum, p) => sum + (Number(p.premium_monthly) || 0),
      0
    );
    
    const policyIds = filteredData.map((p) => p.id);
    const relatedCommissions = commissions.filter((c) => 
      policyIds.includes(c.policy_id)
    );
    const totalCommissions = relatedCommissions.reduce(
      (sum, c) => sum + Number(c.amount),
      0
    );

    const uniqueClients = new Set(filteredData.map((p) => p.client_id)).size;

    return {
      totalContracts,
      totalPremiums,
      totalCommissions,
      uniqueClients,
    };
  }, [filteredData, commissions]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "N° Police",
      "Client",
      "Produit",
      "Compagnie",
      "Statut",
      "Date début",
      "Prime mensuelle",
      "Prime annuelle",
      "Commission totale",
    ];

    const rows = filteredData.map((policy) => {
      const clientName = policy.client?.profile?.first_name
        ? `${policy.client.profile.first_name} ${policy.client.profile.last_name || ""}`
        : policy.client?.company_name || "-";

      const policyCommissions = commissions.filter((c) => c.policy_id === policy.id);
      const totalCommission = policyCommissions.reduce(
        (sum, c) => sum + Number(c.amount),
        0
      );

      return [
        policy.policy_number || "-",
        clientName,
        policy.product?.name || "-",
        policy.product?.company?.name || "-",
        statusLabels[policy.status] || policy.status,
        policy.start_date ? format(new Date(policy.start_date), "dd/MM/yyyy") : "-",
        policy.premium_monthly || "0",
        policy.premium_yearly || "0",
        totalCommission.toFixed(2),
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rapport_${format(new Date(), "yyyy-MM-dd_HHmmss")}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rapports et Analyses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Générez des rapports détaillés et analysez vos performances
          </p>
        </div>
        <Button onClick={exportToCSV} disabled={loading || filteredData.length === 0} size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exporter CSV
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Contrats
              </CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">{stats.totalContracts}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Clients uniques
              </CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">{stats.uniqueClients}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Primes mensuelles
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">
                CHF {stats.totalPremiums.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Commissions totales
              </CardTitle>
              <DollarSign className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">
                CHF {stats.totalCommissions.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtres de recherche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Recherche</Label>
              <Input
                placeholder="Client, N° police, produit..."
                value={filters.searchTerm}
                onChange={(e) =>
                  setFilters({ ...filters, searchTerm: e.target.value })
                }
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Statut</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                  <SelectItem value="expired">Expiré</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Compagnie</Label>
              <Select
                value={filters.company}
                onValueChange={(value) => setFilters({ ...filters, company: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les compagnies</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Année</Label>
              <Select
                value={filters.year || "all"}
                onValueChange={(value) => setFilters({ ...filters, year: value === "all" ? "" : value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(
                    (year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Mois</Label>
              <Select
                value={filters.month || "all"}
                onValueChange={(value) => setFilters({ ...filters, month: value === "all" ? "" : value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <SelectItem key={month} value={month.toString()}>
                      {format(new Date(2000, month - 1), "MMMM", { locale: fr })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Date début (après)</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters({ ...filters, startDate: e.target.value })
                }
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Date début (avant)</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters({ ...filters, endDate: e.target.value })
                }
                className="h-9"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFilters({
                    status: "all",
                    company: "all",
                    startDate: "",
                    endDate: "",
                    year: "all",
                    month: "all",
                    searchTerm: "",
                  })
                }
              >
                Réinitialiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Résultats ({filteredData.length} contrat{filteredData.length !== 1 ? "s" : ""})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">Chargement des données...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">
                Aucun résultat ne correspond à vos critères de recherche.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Police</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Compagnie</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date début</TableHead>
                    <TableHead className="text-right">Prime mens.</TableHead>
                    <TableHead className="text-right">Prime ann.</TableHead>
                    <TableHead className="text-right">Commissions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((policy) => {
                    const clientName = policy.client?.profile?.first_name
                      ? `${policy.client.profile.first_name} ${policy.client.profile.last_name || ""}`
                      : policy.client?.company_name || "-";

                    const policyCommissions = commissions.filter(
                      (c) => c.policy_id === policy.id
                    );
                    const totalCommission = policyCommissions.reduce(
                      (sum, c) => sum + Number(c.amount),
                      0
                    );

                    return (
                      <TableRow key={policy.id}>
                        <TableCell className="font-medium">
                          {policy.policy_number || "-"}
                        </TableCell>
                        <TableCell>{clientName}</TableCell>
                        <TableCell>{policy.product?.name || "-"}</TableCell>
                        <TableCell>{policy.product?.company?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`${statusColors[policy.status]} text-white`}
                          >
                            {statusLabels[policy.status] || policy.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {policy.start_date
                            ? format(new Date(policy.start_date), "dd/MM/yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          CHF {Number(policy.premium_monthly || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          CHF {Number(policy.premium_yearly || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          CHF {totalCommission.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
