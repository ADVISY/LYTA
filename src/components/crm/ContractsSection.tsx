import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  ShieldCheck, Search, Filter, Download, Plus, 
  Eye, Edit, Trash2, Calendar, Building2, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Use the new policies structure instead of the old contracts
interface Policy {
  id: string;
  policy_number: string | null;
  status: string;
  premium_monthly: number | null;
  premium_yearly: number | null;
  start_date: string;
  end_date: string | null;
  created_at: string;
  product?: {
    name: string;
    company?: {
      name: string;
    };
  };
  client?: {
    company_name: string | null;
    is_company: boolean;
    profiles?: {
      full_name: string | null;
    };
  };
}

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function ContractsSection({ userId }: { userId: string }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchPolicies();
  }, [userId]);

  const fetchPolicies = async () => {
    setLoading(true);
    
    // Get partner profile first
    const { data: partner } = await supabase
      .from("partners")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (partner) {
      const { data, error } = await supabase
        .from("policies")
        .select(`
          *,
          product:insurance_products (
            name,
            company:insurance_companies (name)
          ),
          client:clients (
            company_name,
            is_company,
            profiles:user_id (full_name)
          )
        `)
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setPolicies(data as any);
      }
    }
    setLoading(false);
  };

  const getContractIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      'auto': '🚗',
      'menage': '🏠',
      'sante': '🏥',
      'vie': '❤️',
      '3e_pilier': '💰',
      'juridique': '⚖️',
      'hypotheque': '🏦',
    };
    return icons[type] || '📄';
  };

  const getContractLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'auto': 'Assurance Auto',
      'menage': 'RC Ménage',
      'sante': 'Assurance Santé',
      'vie': 'Assurance Vie',
      '3e_pilier': '3e Pilier',
      'juridique': 'Protection Juridique',
      'hypotheque': 'Hypothèque'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-green-500",
      pending: "bg-yellow-500",
      suspended: "bg-orange-500",
      cancelled: "bg-red-500",
      expired: "bg-gray-500",
    };
    return (
      <Badge className={`${variants[status] || "bg-gray-500"} text-white`}>
        {status}
      </Badge>
    );
  };

  const filteredPolicies = policies.filter((policy) => {
    const clientName = policy.client?.is_company 
      ? policy.client.company_name 
      : policy.client?.profiles?.full_name;
    const searchString = `${clientName} ${policy.product?.name} ${policy.policy_number || ""}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const stats = {
    total: policies.length,
    active: policies.filter((p) => p.status === "active").length,
    pending: policies.filter((p) => p.status === "pending").length,
    totalPremiums: policies
      .filter((p) => p.status === "active")
      .reduce((sum, p) => sum + (p.premium_monthly || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={fadeIn} initial="hidden" animate="show">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Polices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn} initial="hidden" animate="show" transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Actives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn} initial="hidden" animate="show" transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                En attente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={fadeIn} initial="hidden" animate="show" transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Primes Mensuelles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalPremiums.toLocaleString("fr-CH")} CHF
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle>Polices d'assurance</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Police
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par client, type, numéro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : filteredPolicies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune police trouvée
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Compagnie</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Prime/mois</TableHead>
                      <TableHead>Début</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPolicies.map((policy) => {
                      const clientName = policy.client?.is_company
                        ? policy.client.company_name
                        : policy.client?.profiles?.full_name;
                      
                      return (
                        <TableRow key={policy.id}>
                          <TableCell className="font-medium">
                            {clientName || "N/A"}
                          </TableCell>
                          <TableCell>{policy.product?.name || "N/A"}</TableCell>
                          <TableCell>{policy.product?.company?.name || "N/A"}</TableCell>
                          <TableCell>{getStatusBadge(policy.status)}</TableCell>
                          <TableCell className="text-right">
                            {policy.premium_monthly 
                              ? `${policy.premium_monthly.toLocaleString("fr-CH")} CHF`
                              : policy.premium_yearly
                              ? `${(policy.premium_yearly / 12).toFixed(2)} CHF`
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {new Date(policy.start_date).toLocaleDateString("fr-CH")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
