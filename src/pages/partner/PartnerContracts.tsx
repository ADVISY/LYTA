import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Search, Building2, Calendar, DollarSign, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePolicies, type Policy } from "@/hooks/usePolicies";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function PartnerContracts() {
  const { policies, loading } = usePolicies();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      'active': 'default', 'pending': 'secondary', 'cancelled': 'destructive', 'expired': 'outline'
    };
    return <Badge variant={variants[status] || 'outline'} className="capitalize">{status}</Badge>;
  };

  const getClientName = (policy: Policy) => {
    if (!policy.client) return 'N/A';
    if (policy.client.company_name) return policy.client.company_name;
    if (policy.client.profile) {
      const { first_name, last_name } = policy.client.profile;
      return `${first_name || ''} ${last_name || ''}`.trim() || 'N/A';
    }
    return 'N/A';
  };

  const filteredPolicies = policies.filter(policy => {
    const clientName = getClientName(policy);
    const productName = policy.product?.name || '';
    const matchesSearch = clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policy.policy_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      productName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || policy.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show" className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Contrats</h1>
          <p className="text-muted-foreground">Gestion de vos polices d'assurance ({filteredPolicies.length})</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Police</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Compagnie</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Prime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPolicies.map((policy) => (
                <TableRow key={policy.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedPolicy(policy); setIsDrawerOpen(true); }}>
                  <TableCell className="font-mono text-sm">{policy.policy_number || 'N/A'}</TableCell>
                  <TableCell className="font-medium">{getClientName(policy)}</TableCell>
                  <TableCell>{policy.product?.name || 'N/A'}</TableCell>
                  <TableCell><Building2 className="h-4 w-4 inline mr-2" />{policy.product?.company?.name || 'N/A'}</TableCell>
                  <TableCell>{getStatusBadge(policy.status)}</TableCell>
                  <TableCell className="text-right">{policy.premium_monthly ? `CHF ${policy.premium_monthly}` : 'N/A'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedPolicy && (
            <>
              <SheetHeader><SheetTitle>Détails du contrat</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="p-4 rounded-xl bg-muted space-y-3">
                  <h3 className="font-semibold">Client</h3>
                  <div className="font-medium">{getClientName(selectedPolicy)}</div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
