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
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [selectedContract, setSelectedContract] = useState<MockContract | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingContract, setEditingContract] = useState<MockContract | null>(null);
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
    const matchesAgent = agentFilter === "all" || contract.agentAdvisy === agentFilter;
    const matchesManager = managerFilter === "all" || contract.managerAdvisy === managerFilter;
    
    return matchesSearch && matchesStatus && matchesCompany && matchesAgent && matchesManager;
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
      title: isEditMode ? "Contrat modifié" : "Contrat créé", 
      description: isEditMode ? "Les modifications ont été enregistrées (mock)" : "Le nouveau contrat a été ajouté (mock)" 
    });
    setIsNewModalOpen(false);
    setIsEditMode(false);
    setEditingContract(null);
  };

  const handleEditClick = (contract: MockContract) => {
    setEditingContract(contract);
    setIsEditMode(true);
    setIsNewModalOpen(true);
  };

  const uniqueCompanies = Array.from(new Set(mockContracts.map(c => c.company)));
  const uniqueAgents = Array.from(new Set(mockContracts.map(c => c.agentAdvisy).filter(Boolean)));
  const uniqueManagers = Array.from(new Set(mockContracts.map(c => c.managerAdvisy).filter(Boolean)));

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
              <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? "Modifier le contrat" : "Nouveau contrat"}</DialogTitle>
                  <DialogDescription>
                    {isEditMode ? "Modifier les informations du contrat et du client" : "Créer un nouveau contrat d'assurance complet"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleNewContract} className="space-y-6">
                  {/* Informations Client */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Informations Client
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prénom *</Label>
                        <Input 
                          placeholder="Prénom" 
                          defaultValue={isEditMode ? editingContract?.client.split(' ')[0] : ""} 
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nom *</Label>
                        <Input 
                          placeholder="Nom de famille" 
                          defaultValue={isEditMode ? editingContract?.client.split(' ')[1] : ""} 
                          required 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input 
                          type="email"
                          placeholder="client@example.com" 
                          defaultValue={isEditMode ? editingContract?.contactEmail : ""} 
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone *</Label>
                        <Input 
                          type="tel"
                          placeholder="+41 XX XXX XX XX" 
                          defaultValue={isEditMode ? editingContract?.contactPhone : ""} 
                          required 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Adresse *</Label>
                      <Input 
                        placeholder="Rue et numéro" 
                        required 
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Code Postal *</Label>
                        <Input 
                          placeholder="1000" 
                          required 
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Ville *</Label>
                        <Input 
                          placeholder="Lausanne" 
                          required 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Date de naissance</Label>
                      <Input type="date" />
                    </div>
                  </div>

                  {/* Informations Bancaires */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Informations Bancaires
                    </h3>
                    <div className="space-y-2">
                      <Label>IBAN</Label>
                      <Input 
                        placeholder="CH93 0000 0000 0000 0000 0" 
                        pattern="[A-Z]{2}[0-9]{2}[A-Z0-9]+"
                      />
                    </div>
                  </div>

                  {/* Informations Advisy */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Informations Advisy
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Agent Advisy *</Label>
                        <Select required defaultValue={isEditMode ? editingContract?.agentAdvisy : ""}>
                          <SelectTrigger className="bg-white dark:bg-slate-800">
                            <SelectValue placeholder="Sélectionner un agent" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 z-50">
                            {uniqueAgents.map(agent => (
                              <SelectItem key={agent} value={agent || ''}>
                                {agent}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Manager Advisy *</Label>
                        <Select required defaultValue={isEditMode ? editingContract?.managerAdvisy : ""}>
                          <SelectTrigger className="bg-white dark:bg-slate-800">
                            <SelectValue placeholder="Sélectionner un manager" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 z-50">
                            {uniqueManagers.map(manager => (
                              <SelectItem key={manager} value={manager || ''}>
                                {manager}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Source d'acquisition</Label>
                        <Select defaultValue={isEditMode ? editingContract?.sourceAcquisition : ""}>
                          <SelectTrigger className="bg-white dark:bg-slate-800">
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 z-50">
                            <SelectItem value="site-web">Site web</SelectItem>
                            <SelectItem value="reference">Référence client</SelectItem>
                            <SelectItem value="parrainage">Parrainage</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="salon">Salon professionnel</SelectItem>
                            <SelectItem value="prospection">Prospection téléphonique</SelectItem>
                            <SelectItem value="agence">Agence physique</SelectItem>
                            <SelectItem value="autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Mode d'encaissement</Label>
                        <Select defaultValue={isEditMode ? editingContract?.modeEncaissement : ""}>
                          <SelectTrigger className="bg-white dark:bg-slate-800">
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 z-50">
                            <SelectItem value="Mensuel">Mensuel</SelectItem>
                            <SelectItem value="Trimestriel">Trimestriel</SelectItem>
                            <SelectItem value="Semestriel">Semestriel</SelectItem>
                            <SelectItem value="Annuel">Annuel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Informations Contrat */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Informations Contrat
                    </h3>
                    <div className="space-y-2">
                      <Label>Numéro de police</Label>
                      <Input 
                        placeholder="POL-2024-XXXXX" 
                        defaultValue={isEditMode ? editingContract?.id : ""} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Type de produit *</Label>
                        <Select required defaultValue={isEditMode ? editingContract?.type.toLowerCase() : ""}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="sante">Santé</SelectItem>
                            <SelectItem value="rc-pro">RC Pro</SelectItem>
                            <SelectItem value="3e-pilier">3e Pilier</SelectItem>
                            <SelectItem value="multirisque">Multirisque</SelectItem>
                            <SelectItem value="menage">RC Ménage</SelectItem>
                            <SelectItem value="vie">Vie</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Compagnie *</Label>
                        <Select required defaultValue={isEditMode ? editingContract?.company : ""}>
                          <SelectTrigger className="bg-white dark:bg-slate-800">
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 z-50 max-h-[300px] overflow-y-auto">
                            <SelectItem value="Allianz">Allianz Suisse</SelectItem>
                            <SelectItem value="AXA">AXA Assurances</SelectItem>
                            <SelectItem value="Zurich">Zurich Insurance</SelectItem>
                            <SelectItem value="Swiss Life">Swiss Life</SelectItem>
                            <SelectItem value="CSS">CSS Assurance</SelectItem>
                            <SelectItem value="Helsana">Helsana</SelectItem>
                            <SelectItem value="Sanitas">Sanitas</SelectItem>
                            <SelectItem value="Groupe Mutuel">Groupe Mutuel</SelectItem>
                            <SelectItem value="Vaudoise">Vaudoise Assurances</SelectItem>
                            <SelectItem value="Helvetia">Helvetia</SelectItem>
                            <SelectItem value="Mobilière">La Mobilière</SelectItem>
                            <SelectItem value="Baloise">Baloise Assurance</SelectItem>
                            <SelectItem value="Generali">Generali Suisse</SelectItem>
                            <SelectItem value="PAX">PAX</SelectItem>
                            <SelectItem value="ÖKK">ÖKK</SelectItem>
                            <SelectItem value="Sympany">Sympany</SelectItem>
                            <SelectItem value="Visana">Visana</SelectItem>
                            <SelectItem value="Assura">Assura</SelectItem>
                            <SelectItem value="SWICA">SWICA</SelectItem>
                            <SelectItem value="Concordia">Concordia</SelectItem>
                            <SelectItem value="Atupri">Atupri</SelectItem>
                            <SelectItem value="EGK">EGK</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date de début *</Label>
                        <Input 
                          type="date" 
                          required 
                          defaultValue={new Date().toISOString().split('T')[0]} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Date de renouvellement *</Label>
                        <Input 
                          type="date" 
                          required 
                          defaultValue={isEditMode && editingContract?.renewal ? new Date(editingContract.renewal).toISOString().split('T')[0] : ""} 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prime mensuelle (CHF)</Label>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          defaultValue={isEditMode && editingContract?.premiumMonthly ? editingContract.premiumMonthly : ""} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Prime annuelle (CHF) *</Label>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          required 
                          defaultValue={isEditMode && editingContract?.premiumYearly ? editingContract.premiumYearly : ""} 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Franchise (CHF)</Label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Statut</Label>
                        <Select defaultValue={isEditMode ? editingContract?.status.toLowerCase() : "en-attente"}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en-attente">En attente</SelectItem>
                            <SelectItem value="signé">Signé</SelectItem>
                            <SelectItem value="refusé">Refusé</SelectItem>
                            <SelectItem value="résilié">Résilié</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes / Remarques</Label>
                      <Input 
                        placeholder="Informations complémentaires..." 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Document PDF</Label>
                      <Input type="file" accept=".pdf" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsNewModalOpen(false);
                        setIsEditMode(false);
                        setEditingContract(null);
                      }}
                    >
                      Annuler
                    </Button>
                    <Button type="submit">
                      {isEditMode ? "Enregistrer les modifications" : "Créer le contrat"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Rechercher client, ID, type..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-xl bg-white dark:bg-slate-800 z-50">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800 z-50">
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="Signé">Signé</SelectItem>
                  <SelectItem value="En attente">En attente</SelectItem>
                  <SelectItem value="Refusé">Refusé</SelectItem>
                  <SelectItem value="Résilié">Résilié</SelectItem>
                </SelectContent>
              </Select>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="rounded-xl bg-white dark:bg-slate-800 z-50">
                  <SelectValue placeholder="Compagnies" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800 z-50">
                  <SelectItem value="all">Toutes les compagnies</SelectItem>
                  {uniqueCompanies.map(company => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="rounded-xl bg-white dark:bg-slate-800 z-50">
                  <SelectValue placeholder="Agents" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800 z-50">
                  <SelectItem value="all">Tous les agents</SelectItem>
                  {uniqueAgents.map(agent => (
                    <SelectItem key={agent} value={agent || ''}>
                      {agent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={managerFilter} onValueChange={setManagerFilter}>
                <SelectTrigger className="rounded-xl bg-white dark:bg-slate-800 z-50">
                  <SelectValue placeholder="Managers" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800 z-50">
                  <SelectItem value="all">Tous les managers</SelectItem>
                  {uniqueManagers.map(manager => (
                    <SelectItem key={manager} value={manager || ''}>
                      {manager}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4">
              <Button 
                variant="outline" 
                className="rounded-xl w-full md:w-auto"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setCompanyFilter("all");
                  setAgentFilter("all");
                  setManagerFilter("all");
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Réinitialiser les filtres
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
                                handleEditClick(contract);
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

                  {/* Advisy Info */}
                  {(selectedContract.agentAdvisy || selectedContract.managerAdvisy) && (
                    <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 space-y-3">
                      <h3 className="font-semibold text-sm">Informations Advisy</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {selectedContract.agentAdvisy && (
                          <div>
                            <Label className="text-xs text-slate-500">Agent</Label>
                            <div className="font-medium">{selectedContract.agentAdvisy}</div>
                          </div>
                        )}
                        {selectedContract.managerAdvisy && (
                          <div>
                            <Label className="text-xs text-slate-500">Manager</Label>
                            <div className="font-medium">{selectedContract.managerAdvisy}</div>
                          </div>
                        )}
                        {selectedContract.sourceAcquisition && (
                          <div className="col-span-2">
                            <Label className="text-xs text-slate-500">Source d'acquisition</Label>
                            <div className="font-medium">{selectedContract.sourceAcquisition}</div>
                          </div>
                        )}
                        {selectedContract.modeEncaissement && (
                          <div className="col-span-2">
                            <Label className="text-xs text-slate-500">Mode d'encaissement</Label>
                            <div className="font-medium">{selectedContract.modeEncaissement}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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
