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
import { mockCommissions, MockCommission, exportToCSV } from "@/lib/mockData";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar
} from "recharts";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function PartnerCommissions() {
  const [commissions, setCommissions] = useState<MockCommission[]>(mockCommissions);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const { toast } = useToast();

  const filteredCommissions = commissions.filter(com => {
    const matchesStatus = statusFilter === "all" || com.status === statusFilter;
    const matchesProduct = productFilter === "all" || com.product === productFilter;
    return matchesStatus && matchesProduct;
  });

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "outline" } = {
      'Versée': 'default',
      'À verser': 'secondary',
      'En validation': 'outline'
    };
    const colors: { [key: string]: string } = {
      'Versée': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'À verser': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'En validation': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    };
    return (
      <Badge className={colors[status]}>
        {status}
      </Badge>
    );
  };

  const handleMarkAsPaid = (id: string) => {
    setCommissions(prev => prev.map(com => 
      com.id === id ? { ...com, status: 'Versée' as const } : com
    ));
    toast({ 
      title: "Commission versée", 
      description: "Le statut a été mis à jour avec succès" 
    });
  };

  const handleExportCSV = () => {
    exportToCSV(filteredCommissions, 'advisy_commissions');
    toast({ title: "Export réussi", description: "Les commissions ont été exportées en CSV" });
  };

  // Calculate totals
  const totals = {
    total: filteredCommissions.reduce((sum, com) => sum + com.amount, 0),
    versees: filteredCommissions.filter(c => c.status === 'Versée').reduce((sum, com) => sum + com.amount, 0),
    aVerser: filteredCommissions.filter(c => c.status === 'À verser').reduce((sum, com) => sum + com.amount, 0),
    enValidation: filteredCommissions.filter(c => c.status === 'En validation').reduce((sum, com) => sum + com.amount, 0)
  };

  const uniqueProducts = Array.from(new Set(mockCommissions.map(c => c.product)));

  // Mock chart data
  const chartData = [
    { month: 'Jan', commissions: 2400 },
    { month: 'Fév', commissions: 1800 },
    { month: 'Mar', commissions: 3200 },
    { month: 'Avr', commissions: 2800 },
    { month: 'Mai', commissions: 3600 },
    { month: 'Juin', commissions: 4200 },
    { month: 'Juil', commissions: 3800 },
    { month: 'Aoû', commissions: 4100 },
    { month: 'Sep', commissions: 3400 },
    { month: 'Oct', commissions: 3900 },
    { month: 'Nov', commissions: 4500 },
    { month: 'Déc', commissions: 0 }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 dark:from-slate-950 dark:to-slate-900 p-6">
      <motion.div 
        variants={fadeIn} 
        initial="hidden" 
        animate="show"
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <DollarSign className="h-7 w-7" />
              Commissions
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Gestion et suivi des commissions
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            className="rounded-xl"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={fadeIn}>
            <Card className="rounded-2xl border-white/30 dark:border-slate-700/40 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Période</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
                      CHF {totals.total.toFixed(2)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Card className="rounded-2xl border-white/30 dark:border-slate-700/40 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Versées</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
                      CHF {totals.versees.toFixed(2)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Card className="rounded-2xl border-white/30 dark:border-slate-700/40 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">À Verser</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
                      CHF {totals.aVerser.toFixed(2)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Card className="rounded-2xl border-white/30 dark:border-slate-700/40 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">En Validation</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">
                      CHF {totals.enValidation.toFixed(2)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Chart */}
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-slate-800 dark:text-slate-100">
              Évolution des commissions par mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="month" 
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="commissions" 
                  fill="url(#colorCommissions)" 
                  radius={[8, 8, 0, 0]}
                />
                <defs>
                  <linearGradient id="colorCommissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="Versée">Versée</SelectItem>
                  <SelectItem value="À verser">À verser</SelectItem>
                  <SelectItem value="En validation">En validation</SelectItem>
                </SelectContent>
              </Select>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Tous les produits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les produits</SelectItem>
                  {uniqueProducts.map(product => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                className="rounded-xl"
                onClick={() => {
                  setStatusFilter("all");
                  setProductFilter("all");
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Réinitialiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
          <CardContent className="p-6">
            {filteredCommissions.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-2">Aucune commission trouvée</p>
                <p className="text-sm text-slate-400">
                  Modifiez vos filtres pour voir plus de résultats
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                      <TableHead className="font-semibold">Contrat ID</TableHead>
                      <TableHead className="font-semibold">Produit</TableHead>
                      <TableHead className="font-semibold">Compagnie</TableHead>
                      <TableHead className="font-semibold text-right">Montant</TableHead>
                      <TableHead className="font-semibold">Statut</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommissions.map((commission) => (
                      <TableRow 
                        key={commission.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <TableCell className="font-mono text-sm">{commission.contractId}</TableCell>
                        <TableCell className="font-medium">{commission.product}</TableCell>
                        <TableCell>{commission.company}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-slate-900 dark:text-slate-50">
                            CHF {commission.amount.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(commission.status)}</TableCell>
                        <TableCell>
                          {new Date(commission.date).toLocaleDateString('fr-CH')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {commission.status === 'À verser' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="rounded-xl"
                                onClick={() => handleMarkAsPaid(commission.id)}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Marquer versée
                              </Button>
                            )}
                            {commission.status === 'Versée' && (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Versée
                              </Badge>
                            )}
                            {commission.status === 'En validation' && (
                              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                <Clock className="h-3 w-3 mr-1" />
                                En validation
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
