import { useState } from "react";
import { motion } from "framer-motion";
import { 
  FileText, Search, Filter, Download, Plus, 
  Eye, Edit, Building2, Calendar, Phone, Mail,
  DollarSign, X, ChevronRight, FileSignature
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { mockContracts, MockContract, exportToCSV } from "@/lib/mockData";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function PartnerContracts() {
  const [contracts, setContracts] = useState<MockContract[]>(mockContracts);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [selectedContract, setSelectedContract] = useState<MockContract | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const { toast } = useToast();

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      'Signé': 'default',
      'En attente': 'secondary',
      'Refusé': 'destructive',
      'Résilié': 'outline'
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
    const matchesCompany = companyFilter === "all" || contract.company === companyFilter;
    
    return matchesSearch && matchesStatus && matchesCompany;
  });

  const handleExportCSV = () => {
    exportToCSV(filteredContracts, 'advisy_contracts');
    toast({ title: "Export réussi", description: "Les contrats ont été exportés en CSV" });
  };

  const handleRowClick = (contract: MockContract) => {
    setSelectedContract(contract);
    setIsDrawerOpen(true);
  };

  const handleCommissionToggle = () => {
    toast({ 
      title: "Commission mise à jour", 
      description: "Le statut de commission a été modifié (mock)" 
    });
  };

  const handleNewContract = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ 
      title: "Contrat créé", 
      description: "Le nouveau contrat a été ajouté (mock)" 
    });
    setIsNewModalOpen(false);
  };

  const uniqueCompanies = Array.from(new Set(mockContracts.map(c => c.company)));

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
              <FileText className="h-7 w-7" />
              Gestion des Contrats
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {filteredContracts.length} contrat{filteredContracts.length > 1 ? 's' : ''} trouvé{filteredContracts.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleExportCSV}
              className="rounded-xl"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau contrat
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Nouveau contrat</DialogTitle>
                  <DialogDescription>
                    Créer un nouveau contrat d'assurance (mock)
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleNewContract} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Input placeholder="Nom du client" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Type de produit</Label>
                    <Select required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="sante">Santé</SelectItem>
                        <SelectItem value="rc-pro">RC Pro</SelectItem>
                        <SelectItem value="3e-pilier">3e Pilier</SelectItem>
                        <SelectItem value="multirisque">Multirisque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Compagnie</Label>
                    <Select required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueCompanies.map(company => (
                          <SelectItem key={company} value={company.toLowerCase()}>
                            {company}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Prime mensuelle (CHF)</Label>
                      <Input type="number" placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label>Prime annuelle (CHF)</Label>
                      <Input type="number" placeholder="0" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Date de renouvellement</Label>
                    <Input type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Document PDF</Label>
                    <Input type="file" accept=".pdf" />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsNewModalOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button type="submit">Créer le contrat</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Rechercher client, ID, type..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="Signé">Signé</SelectItem>
                  <SelectItem value="En attente">En attente</SelectItem>
                  <SelectItem value="Refusé">Refusé</SelectItem>
                  <SelectItem value="Résilié">Résilié</SelectItem>
                </SelectContent>
              </Select>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Toutes les compagnies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les compagnies</SelectItem>
                  {uniqueCompanies.map(company => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                className="rounded-xl"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setCompanyFilter("all");
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Réinitialiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
          <CardContent className="p-6">
            {filteredContracts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-2">Aucun contrat trouvé</p>
                <p className="text-sm text-slate-400">
                  Modifiez vos filtres ou créez un nouveau contrat
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                      <TableHead className="font-semibold">ID</TableHead>
                      <TableHead className="font-semibold">Client</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Compagnie</TableHead>
                      <TableHead className="font-semibold">Statut</TableHead>
                      <TableHead className="font-semibold text-right">Prime/mois</TableHead>
                      <TableHead className="font-semibold">Renouvellement</TableHead>
                      <TableHead className="font-semibold text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((contract) => (
                      <TableRow 
                        key={contract.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                        onClick={() => handleRowClick(contract)}
                      >
                        <TableCell className="font-mono text-sm">{contract.id}</TableCell>
                        <TableCell className="font-medium">{contract.client}</TableCell>
                        <TableCell>{contract.type}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-400" />
                            {contract.company}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(contract.status)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {contract.premiumMonthly ? `CHF ${contract.premiumMonthly}` : '-'}
                        </TableCell>
                        <TableCell>
                          {contract.renewal ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              {new Date(contract.renewal).toLocaleDateString('fr-CH')}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(contract);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toast({ title: "Édition", description: "Fonctionnalité en développement" });
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
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

        {/* Contract Details Drawer */}
        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {selectedContract && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5" />
                    Détails du contrat
                  </SheetTitle>
                  <SheetDescription>
                    Contrat {selectedContract.id}
                  </SheetDescription>
                </SheetHeader>
                
                <div className="mt-6 space-y-6">
                  {/* Status */}
                  <div>
                    <Label className="text-xs text-slate-500 uppercase">Statut</Label>
                    <div className="mt-2">{getStatusBadge(selectedContract.status)}</div>
                  </div>

                  {/* Client Info */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Informations client
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <Label className="text-xs text-slate-500">Nom</Label>
                        <div className="font-medium">{selectedContract.client}</div>
                      </div>
                      {selectedContract.contactEmail && (
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Mail className="h-4 w-4" />
                          {selectedContract.contactEmail}
                        </div>
                      )}
                      {selectedContract.contactPhone && (
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Phone className="h-4 w-4" />
                          {selectedContract.contactPhone}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contract Details */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Détails du contrat</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-slate-500">Type</Label>
                        <div className="font-medium">{selectedContract.type}</div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Compagnie</Label>
                        <div className="font-medium">{selectedContract.company}</div>
                      </div>
                      {selectedContract.policyNumber && (
                        <div className="col-span-2">
                          <Label className="text-xs text-slate-500">N° de police</Label>
                          <div className="font-mono text-sm">{selectedContract.policyNumber}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Info */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Informations financières
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-slate-500">Prime mensuelle</Label>
                        <div className="text-lg font-bold">
                          {selectedContract.premiumMonthly ? `CHF ${selectedContract.premiumMonthly}` : '-'}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Prime annuelle</Label>
                        <div className="text-lg font-bold">
                          {selectedContract.premiumYearly ? `CHF ${selectedContract.premiumYearly}` : '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-500">Date de création</Label>
                      <div className="font-medium">
                        {new Date(selectedContract.createdAt).toLocaleDateString('fr-CH')}
                      </div>
                    </div>
                    {selectedContract.renewal && (
                      <div>
                        <Label className="text-xs text-slate-500">Renouvellement</Label>
                        <div className="font-medium">
                          {new Date(selectedContract.renewal).toLocaleDateString('fr-CH')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-4 space-y-2">
                    <Button 
                      className="w-full rounded-xl"
                      onClick={handleCommissionToggle}
                    >
                      Commissionner ce contrat
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full rounded-xl"
                      onClick={() => toast({ title: "Documents", description: "Voir les documents liés (mock)" })}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Voir les documents
                    </Button>
                  </div>

                  {/* Timeline Mock */}
                  <div className="pt-4">
                    <h3 className="font-semibold text-sm mb-3">Timeline</h3>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                          <ChevronRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Contrat signé</div>
                          <div className="text-xs text-slate-500">{selectedContract.createdAt}</div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Documents uploadés</div>
                          <div className="text-xs text-slate-500">2 fichiers</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </motion.div>
    </div>
  );
}
