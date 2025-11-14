import { useState } from "react";
import { motion } from "framer-motion";
import { 
  DollarSign, TrendingUp, Clock, CheckCircle2,
  Download, Filter, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportToCSV } from "@/lib/mockData";
import { useCommissions } from "@/hooks/useCommissions";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar
} from "recharts";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function AllCommissions() {
  const { commissions, loading, markAsPaid } = useCommissions();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const { toast } = useToast();

  const filteredCommissions = commissions.filter(com => {
    const matchesStatus = statusFilter === "all" || com.status === statusFilter;
    const productName = com.policy?.product?.name || '';
    const matchesProduct = productFilter === "all" || productName === productFilter;
    return matchesStatus && matchesProduct;
  });

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'paid': 'Versée',
      'due': 'À verser',
      'pending': 'En validation'
    };
    const displayStatus = statusMap[status] || status;
    const colors: { [key: string]: string } = {
      'paid': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'due': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'pending': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    };
    return (
      <Badge className={colors[status] || 'bg-slate-100 text-slate-700'}>
        {displayStatus}
      </Badge>
    );
  };

  const handleMarkAsPaid = async (id: string) => {
    await markAsPaid(id);
  };

  const handleExportCSV = () => {
    exportToCSV(filteredCommissions, 'advisy_all_commissions');
    toast({ title: "Export réussi", description: "Les commissions ont été exportées en CSV" });
  };

  // Calculate totals
  const totals = {
    total: filteredCommissions.reduce((sum, com) => sum + (com.amount || 0), 0),
    versees: filteredCommissions.filter(c => c.status === 'paid').reduce((sum, com) => sum + (com.amount || 0), 0),
    aVerser: filteredCommissions.filter(c => c.status === 'due').reduce((sum, com) => sum + (com.amount || 0), 0),
    enValidation: filteredCommissions.filter(c => c.status === 'pending').reduce((sum, com) => sum + (com.amount || 0), 0)
  };

  const uniqueProducts = Array.from(new Set(commissions.map(c => c.policy?.product?.name).filter(Boolean)));

  // Mock chart data - in real app, aggregate from actual data
  const chartData = [
    { month: 'Jan', commissions: 12400 },
    { month: 'Fév', commissions: 8800 },
    { month: 'Mar', commissions: 15200 },
    { month: 'Avr', commissions: 11800 },
    { month: 'Mai', commissions: 16600 },
    { month: 'Juin', commissions: 19200 },
    { month: 'Juil', commissions: 17800 },
    { month: 'Aoû', commissions: 18100 },
    { month: 'Sep', commissions: 14400 },
    { month: 'Oct', commissions: 16900 },
    { month: 'Nov', commissions: 20500 },
    { month: 'Déc', commissions: 0 }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.div variants={fadeIn} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Toutes les Commissions</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gestion globale de toutes les commissions du système
            </p>
          </div>
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">CHF {totals.total.toLocaleString('fr-CH')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Versées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">CHF {totals.versees.toLocaleString('fr-CH')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                À verser
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">CHF {totals.aVerser.toLocaleString('fr-CH')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                En validation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">CHF {totals.enValidation.toLocaleString('fr-CH')}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Évolution des commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="commissions" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Liste des commissions</CardTitle>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="paid">Versées</SelectItem>
                    <SelectItem value="due">À verser</SelectItem>
                    <SelectItem value="pending">En validation</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Produit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les produits</SelectItem>
                    {uniqueProducts.map(product => (
                      <SelectItem key={product} value={product}>{product}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredCommissions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucune commission trouvée.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Période</TableHead>
                    <TableHead>Partenaire</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommissions.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell>
                        {commission.period_month}/{commission.period_year}
                      </TableCell>
                    <TableCell>
                      {commission.partner_id ? 'Partenaire ID: ' + commission.partner_id.substring(0, 8) : 'N/A'}
                    </TableCell>
                      <TableCell>{commission.policy?.product?.name || 'N/A'}</TableCell>
                      <TableCell>
                        {commission.policy?.client?.profile?.first_name || 
                         commission.policy?.client?.company_name || 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">
                        CHF {commission.amount.toLocaleString('fr-CH')}
                      </TableCell>
                      <TableCell>{getStatusBadge(commission.status)}</TableCell>
                      <TableCell>
                        {commission.status === 'due' && (
                          <Button
                            size="sm"
                            onClick={() => handleMarkAsPaid(commission.id)}
                            variant="outline"
                          >
                            Marquer versée
                          </Button>
                        )}
                        {commission.status === 'paid' && commission.paid_at && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(commission.paid_at).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
