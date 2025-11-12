import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Users, Search, Filter, Download, Plus, 
  Eye, Edit, Mail, Phone, MapPin, Calendar,
  Building2, X, ChevronRight, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  birthdate?: string;
  iban?: string;
  contractsCount: number;
  totalPremium: number;
  status: 'Actif' | 'Inactif' | 'Prospect';
  createdAt: string;
}

// Mock data
const mockClients: Client[] = [
  {
    id: "CLI-001",
    firstName: "Marie",
    lastName: "Dupont",
    email: "marie.dupont@email.ch",
    phone: "+41 79 123 45 67",
    address: "Rue de la Paix 12",
    city: "Lausanne",
    postalCode: "1003",
    birthdate: "1985-03-15",
    iban: "CH93 0000 0000 0000 0000 0",
    contractsCount: 3,
    totalPremium: 4500,
    status: 'Actif',
    createdAt: "2023-01-15"
  },
  {
    id: "CLI-002",
    firstName: "Jean",
    lastName: "Martin",
    email: "jean.martin@email.ch",
    phone: "+41 78 987 65 43",
    address: "Avenue des Sports 25",
    city: "Genève",
    postalCode: "1201",
    birthdate: "1978-07-22",
    contractsCount: 2,
    totalPremium: 3200,
    status: 'Actif',
    createdAt: "2023-02-20"
  },
  {
    id: "CLI-003",
    firstName: "Sophie",
    lastName: "Bernard",
    email: "sophie.bernard@email.ch",
    phone: "+41 76 555 44 33",
    address: "Chemin du Lac 8",
    city: "Montreux",
    postalCode: "1820",
    contractsCount: 0,
    totalPremium: 0,
    status: 'Prospect',
    createdAt: "2024-01-10"
  }
];

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function PartnerClients() {
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const { toast } = useToast();

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "outline" } = {
      'Actif': 'default',
      'Inactif': 'secondary',
      'Prospect': 'outline'
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = 
      client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || client.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    toast({ title: "Export réussi", description: "Les clients ont été exportés en CSV" });
  };

  const handleRowClick = (client: Client) => {
    setSelectedClient(client);
    setIsDrawerOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ 
      title: isEditMode ? "Client modifié" : "Client créé", 
      description: isEditMode ? "Les modifications ont été enregistrées" : "Le nouveau client a été ajouté" 
    });
    setIsModalOpen(false);
    setIsEditMode(false);
    setEditingClient(null);
  };

  const handleEditClick = (client: Client) => {
    setEditingClient(client);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

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
              <Users className="h-7 w-7" />
              Gestion des Clients
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {filteredClients.length} client{filteredClients.length > 1 ? 's' : ''} trouvé{filteredClients.length > 1 ? 's' : ''}
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
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl" onClick={() => {
                  setIsEditMode(false);
                  setEditingClient(null);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau client
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? "Modifier le client" : "Nouveau client"}</DialogTitle>
                  <DialogDescription>
                    {isEditMode ? "Modifier les informations du client" : "Ajouter un nouveau client"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Informations Personnelles */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Informations Personnelles
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prénom *</Label>
                        <Input 
                          placeholder="Prénom" 
                          defaultValue={isEditMode ? editingClient?.firstName : ""} 
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nom *</Label>
                        <Input 
                          placeholder="Nom de famille" 
                          defaultValue={isEditMode ? editingClient?.lastName : ""} 
                          required 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Date de naissance</Label>
                      <Input 
                        type="date" 
                        defaultValue={isEditMode ? editingClient?.birthdate : ""} 
                      />
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Contact
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input 
                          type="email"
                          placeholder="client@example.com" 
                          defaultValue={isEditMode ? editingClient?.email : ""} 
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone *</Label>
                        <Input 
                          type="tel"
                          placeholder="+41 XX XXX XX XX" 
                          defaultValue={isEditMode ? editingClient?.phone : ""} 
                          required 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Adresse */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Adresse
                    </h3>
                    <div className="space-y-2">
                      <Label>Adresse *</Label>
                      <Input 
                        placeholder="Rue et numéro" 
                        defaultValue={isEditMode ? editingClient?.address : ""} 
                        required 
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Code Postal *</Label>
                        <Input 
                          placeholder="1000" 
                          defaultValue={isEditMode ? editingClient?.postalCode : ""} 
                          required 
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Ville *</Label>
                        <Input 
                          placeholder="Lausanne" 
                          defaultValue={isEditMode ? editingClient?.city : ""} 
                          required 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Informations Bancaires */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Informations Bancaires
                    </h3>
                    <div className="space-y-2">
                      <Label>IBAN</Label>
                      <Input 
                        placeholder="CH93 0000 0000 0000 0000 0" 
                        defaultValue={isEditMode ? editingClient?.iban : ""} 
                        pattern="[A-Z]{2}[0-9]{2}[A-Z0-9]+"
                      />
                    </div>
                  </div>

                  {/* Statut */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Statut</Label>
                      <Select defaultValue={isEditMode ? editingClient?.status.toLowerCase() : "prospect"}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="actif">Actif</SelectItem>
                          <SelectItem value="prospect">Prospect</SelectItem>
                          <SelectItem value="inactif">Inactif</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsModalOpen(false);
                        setIsEditMode(false);
                        setEditingClient(null);
                      }}
                    >
                      Annuler
                    </Button>
                    <Button type="submit">
                      {isEditMode ? "Enregistrer" : "Créer le client"}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Rechercher par nom, email, ID..." 
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
                  <SelectItem value="Actif">Actif</SelectItem>
                  <SelectItem value="Prospect">Prospect</SelectItem>
                  <SelectItem value="Inactif">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
          <CardContent className="p-6">
            {filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-2">Aucun client trouvé</p>
                <p className="text-sm text-slate-400">
                  Modifiez vos filtres ou créez un nouveau client
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                      <TableHead className="font-semibold">ID</TableHead>
                      <TableHead className="font-semibold">Nom complet</TableHead>
                      <TableHead className="font-semibold">Email</TableHead>
                      <TableHead className="font-semibold">Téléphone</TableHead>
                      <TableHead className="font-semibold">Ville</TableHead>
                      <TableHead className="font-semibold">Statut</TableHead>
                      <TableHead className="font-semibold text-right">Contrats</TableHead>
                      <TableHead className="font-semibold text-right">Prime totale</TableHead>
                      <TableHead className="font-semibold text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow 
                        key={client.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                        onClick={() => handleRowClick(client)}
                      >
                        <TableCell className="font-mono text-sm">{client.id}</TableCell>
                        <TableCell className="font-medium">
                          {client.firstName} {client.lastName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-slate-400" />
                            {client.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {client.phone}
                          </div>
                        </TableCell>
                        <TableCell>{client.city}</TableCell>
                        <TableCell>{getStatusBadge(client.status)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {client.contractsCount}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          CHF {client.totalPremium.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(client);
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
                                handleEditClick(client);
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

        {/* Client Details Drawer */}
        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {selectedClient && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Détails du client
                  </SheetTitle>
                  <SheetDescription>
                    Client {selectedClient.id}
                  </SheetDescription>
                </SheetHeader>
                
                <div className="mt-6 space-y-6">
                  {/* Status */}
                  <div>
                    <Label className="text-xs text-slate-500 uppercase">Statut</Label>
                    <div className="mt-2">{getStatusBadge(selectedClient.status)}</div>
                  </div>

                  {/* Personal Info */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Informations personnelles
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <Label className="text-xs text-slate-500">Nom complet</Label>
                        <div className="font-medium">{selectedClient.firstName} {selectedClient.lastName}</div>
                      </div>
                      {selectedClient.birthdate && (
                        <div>
                          <Label className="text-xs text-slate-500">Date de naissance</Label>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {new Date(selectedClient.birthdate).toLocaleDateString('fr-CH')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Contact
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Mail className="h-4 w-4" />
                        {selectedClient.email}
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Phone className="h-4 w-4" />
                        {selectedClient.phone}
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Adresse
                    </h3>
                    <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                      <div>{selectedClient.address}</div>
                      <div>{selectedClient.postalCode} {selectedClient.city}</div>
                    </div>
                  </div>

                  {/* Banking */}
                  {selectedClient.iban && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-3">
                      <h3 className="font-semibold text-sm">Informations bancaires</h3>
                      <div className="text-sm">
                        <Label className="text-xs text-slate-500">IBAN</Label>
                        <div className="font-mono">{selectedClient.iban}</div>
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {selectedClient.contractsCount}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">Contrats</div>
                    </div>
                    <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        CHF {selectedClient.totalPremium.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">Prime totale</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        handleEditClick(selectedClient);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Modifier
                    </Button>
                    <Button 
                      className="flex-1"
                      onClick={() => {
                        toast({ title: "Navigation", description: "Voir les contrats du client" });
                      }}
                    >
                      <ChevronRight className="h-4 w-4 mr-2" />
                      Voir contrats
                    </Button>
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
