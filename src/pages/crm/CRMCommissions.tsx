import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DollarSign, TrendingUp, Wallet, PiggyBank, Search, MoreHorizontal, CheckCircle, Clock, AlertCircle, Eye, Trash2, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommissions, Commission } from "@/hooks/useCommissions";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import CommissionForm from "@/components/crm/CommissionForm";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  due: { label: "À payer", color: "bg-amber-100 text-amber-800", icon: Clock },
  pending: { label: "En attente", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
  paid: { label: "Payée", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
};

const typeConfig: Record<string, { label: string; color: string }> = {
  acquisition: { label: "Acquisition", color: "bg-violet-100 text-violet-800" },
  renewal: { label: "Renouvellement", color: "bg-cyan-100 text-cyan-800" },
  bonus: { label: "Bonus", color: "bg-pink-100 text-pink-800" },
};

export default function CRMCommissions() {
  const navigate = useNavigate();
  const { commissions, loading, fetchCommissions, markAsPaid, deleteCommission } = useCommissions();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commissionToDelete, setCommissionToDelete] = useState<string | null>(null);
  const [commissionFormOpen, setCommissionFormOpen] = useState(false);

  useEffect(() => {
    fetchCommissions();
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = commissions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const pending = commissions.filter(c => c.status === 'due' || c.status === 'pending')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const paid = commissions.filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    
    const lastMonth = commissions.filter(c => {
      const date = new Date(c.created_at);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).reduce((sum, c) => sum + Number(c.amount || 0), 0);

    return { total, pending, paid, lastMonth };
  }, [commissions]);

  // Filter commissions
  const filteredCommissions = useMemo(() => {
    return commissions.filter(commission => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const clientName = commission.policy?.client?.company_name || 
          `${commission.policy?.client?.first_name || ''} ${commission.policy?.client?.last_name || ''}`;
        const productName = commission.policy?.product?.name || '';
        const policyNumber = commission.policy?.policy_number || '';
        
        if (!clientName.toLowerCase().includes(query) && 
            !productName.toLowerCase().includes(query) &&
            !policyNumber.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "all" && commission.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== "all" && commission.type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [commissions, searchQuery, statusFilter, typeFilter]);

  const handleMarkAsPaid = async (id: string) => {
    await markAsPaid(id);
  };

  const handleDelete = async () => {
    if (commissionToDelete) {
      await deleteCommission(commissionToDelete);
      setCommissionToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(amount);
  };

  const statsCards = [
    { label: "Total ce mois", value: formatCurrency(stats.lastMonth), icon: DollarSign, color: "from-emerald-500 to-teal-600" },
    { label: "En attente", value: formatCurrency(stats.pending), icon: Wallet, color: "from-amber-500 to-orange-600" },
    { label: "Payées", value: formatCurrency(stats.paid), icon: PiggyBank, color: "from-blue-500 to-indigo-600" },
    { label: "Total", value: formatCurrency(stats.total), icon: TrendingUp, color: "from-violet-500 to-purple-600" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent rounded-3xl blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl blur-lg opacity-50" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl">
              <DollarSign className="h-7 w-7 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Commissions
            </h1>
            <p className="text-muted-foreground">Suivez vos commissions et revenus</p>
          </div>
          <Button onClick={() => setCommissionFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle commission
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {statsCards.map((stat, index) => (
          <Card 
            key={stat.label} 
            className="group border-0 shadow-lg bg-card/80 backdrop-blur hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden"
          >
            <div className={cn(
              "absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-10 blur-2xl bg-gradient-to-br",
              stat.color
            )} />
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

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par client, produit, n° police..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="due">À payer</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="paid">Payée</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="acquisition">Acquisition</SelectItem>
                <SelectItem value="renewal">Renouvellement</SelectItem>
                <SelectItem value="bonus">Bonus</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Commissions Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Liste des commissions ({filteredCommissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCommissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Aucune commission trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>N° Police</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommissions.map((commission) => {
                    const status = statusConfig[commission.status] || statusConfig.pending;
                    const type = typeConfig[commission.type || 'acquisition'] || typeConfig.acquisition;
                    const StatusIcon = status.icon;
                    
                    const clientName = commission.policy?.client?.company_name || 
                      `${commission.policy?.client?.first_name || ''} ${commission.policy?.client?.last_name || ''}`.trim() ||
                      'Client inconnu';

                    return (
                      <TableRow key={commission.id} className="group">
                        <TableCell className="font-medium">
                          {commission.policy?.client?.id ? (
                            <button
                              onClick={() => navigate(`/crm/clients/${commission.policy?.client?.id}`)}
                              className="hover:text-primary hover:underline text-left"
                            >
                              {clientName}
                            </button>
                          ) : (
                            clientName
                          )}
                        </TableCell>
                        <TableCell>{commission.policy?.product?.name || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {commission.policy?.policy_number || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={type.color}>
                            {type.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-emerald-600">
                          {formatCurrency(Number(commission.amount))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("gap-1", status.color)}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {commission.paid_at 
                            ? format(new Date(commission.paid_at), 'dd MMM yyyy', { locale: fr })
                            : commission.date 
                              ? format(new Date(commission.date), 'dd MMM yyyy', { locale: fr })
                              : format(new Date(commission.created_at), 'dd MMM yyyy', { locale: fr })
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {commission.policy?.client?.id && (
                                <DropdownMenuItem onClick={() => navigate(`/crm/clients/${commission.policy?.client?.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Voir le client
                                </DropdownMenuItem>
                              )}
                              {commission.status !== 'paid' && (
                                <DropdownMenuItem onClick={() => handleMarkAsPaid(commission.id)}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Marquer comme payée
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => {
                                  setCommissionToDelete(commission.id);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette commission ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La commission sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Commission Form */}
      <CommissionForm
        open={commissionFormOpen}
        onOpenChange={setCommissionFormOpen}
        onSuccess={fetchCommissions}
      />
    </div>
  );
}
