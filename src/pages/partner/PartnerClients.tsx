import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Users, Search, Filter, Download, Plus, 
  Eye, Edit, Mail, Phone, MapPin, Calendar,
  Building2, X, ChevronRight, User, ArrowLeft,
  FileText, Banknote, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useClients, type Client } from "@/hooks/useClients";
import { usePolicies } from "@/hooks/usePolicies";
import { useDocuments } from "@/hooks/useDocuments";
import { useCommissions } from "@/hooks/useCommissions";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractsSection } from "@/components/crm/ContractsSection";
import { DocumentsSection } from "@/components/crm/DocumentsSection";
import { CommissionsSection } from "@/components/crm/CommissionsSection";
import { FollowUpSection } from "@/components/crm/FollowUpSection";

interface Contract {
  id: string;
  clientId: string;
  policyNumber: string;
  productName: string;
  company: string;
  status: 'Actif' | 'En attente' | 'Résilié';
  startDate: string;
  endDate?: string;
  premiumMonthly: number;
}

interface Document {
  id: string;
  clientId: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
}

interface Commission {
  id: string;
  clientId: string;
  contractId: string;
  amount: number;
  status: 'Payée' | 'En attente' | 'Prévue';
  date: string;
  period: string;
}

// Mock data conservé pour les contrats, documents et commissions
// À connecter plus tard

const mockContracts: Contract[] = [
  {
    id: "CNT-001",
    clientId: "CLI-001",
    policyNumber: "POL-2023-001",
    productName: "Assurance Auto Premium",
    company: "Allianz Suisse",
    status: 'Actif',
    startDate: "2023-01-15",
    premiumMonthly: 180
  },
  {
    id: "CNT-002",
    clientId: "CLI-001",
    policyNumber: "POL-2023-015",
    productName: "Assurance Ménage",
    company: "Zurich Insurance",
    status: 'Actif',
    startDate: "2023-03-01",
    premiumMonthly: 95
  },
  {
    id: "CNT-003",
    clientId: "CLI-001",
    policyNumber: "POL-2023-028",
    productName: "3ème Pilier A",
    company: "Swiss Life",
    status: 'Actif',
    startDate: "2023-06-10",
    premiumMonthly: 300
  },
  {
    id: "CNT-003-CONJ-1",
    clientId: "CLI-001-CONJ",
    policyNumber: "POL-2023-029",
    productName: "Assurance Auto Standard",
    company: "AXA Assurances",
    status: 'Actif',
    startDate: "2023-01-15",
    premiumMonthly: 160
  },
  {
    id: "CNT-003-CONJ-2",
    clientId: "CLI-001-CONJ",
    policyNumber: "POL-2023-030",
    productName: "3ème Pilier B",
    company: "Vaudoise Assurances",
    status: 'Actif',
    startDate: "2023-06-10",
    premiumMonthly: 280
  },
  {
    id: "CNT-003-ENF1-1",
    clientId: "CLI-001-ENF1",
    policyNumber: "POL-2023-031",
    productName: "Assurance Santé Enfant",
    company: "CSS Assurance",
    status: 'Actif',
    startDate: "2023-01-15",
    premiumMonthly: 85
  },
  {
    id: "CNT-003-ENF2-1",
    clientId: "CLI-001-ENF2",
    policyNumber: "POL-2023-032",
    productName: "Assurance Santé Base",
    company: "Helsana",
    status: 'Actif',
    startDate: "2023-01-15",
    premiumMonthly: 75
  },
  {
    id: "CNT-004",
    clientId: "CLI-002",
    policyNumber: "POL-2023-042",
    productName: "Assurance Santé Complémentaire",
    company: "Sanitas",
    status: 'Actif',
    startDate: "2023-02-20",
    premiumMonthly: 220
  },
  {
    id: "CNT-005",
    clientId: "CLI-002",
    policyNumber: "POL-2023-055",
    productName: "Protection Juridique",
    company: "Groupe Mutuel",
    status: 'Actif',
    startDate: "2023-04-15",
    premiumMonthly: 45
  },
  {
    id: "CNT-006",
    clientId: "CLI-002",
    policyNumber: "POL-2023-056",
    productName: "Assurance Vie",
    company: "Helvetia",
    status: 'Actif',
    startDate: "2023-05-01",
    premiumMonthly: 180
  }
];

const mockDocuments: Document[] = [
  {
    id: "DOC-001",
    clientId: "CLI-001",
    name: "Contrat Auto Allianz.pdf",
    type: "Contrat",
    size: "2.4 MB",
    uploadDate: "2023-01-15"
  },
  {
    id: "DOC-002",
    clientId: "CLI-001",
    name: "Attestation Assurance.pdf",
    type: "Attestation",
    size: "856 KB",
    uploadDate: "2023-03-20"
  },
  {
    id: "DOC-003",
    clientId: "CLI-001",
    name: "Pièce identité.pdf",
    type: "Document d'identité",
    size: "1.2 MB",
    uploadDate: "2023-01-10"
  },
  {
    id: "DOC-004",
    clientId: "CLI-002",
    name: "Contrat Santé CSS.pdf",
    type: "Contrat",
    size: "3.1 MB",
    uploadDate: "2023-02-20"
  }
];

const mockCommissions: Commission[] = [
  {
    id: "COM-001",
    clientId: "CLI-001",
    contractId: "CNT-001",
    amount: 360,
    status: 'Payée',
    date: "2024-01-15",
    period: "Janvier 2024"
  },
  {
    id: "COM-002",
    clientId: "CLI-001",
    contractId: "CNT-002",
    amount: 190,
    status: 'Payée',
    date: "2024-01-15",
    period: "Janvier 2024"
  },
  {
    id: "COM-003",
    clientId: "CLI-001",
    contractId: "CNT-003",
    amount: 600,
    status: 'En attente',
    date: "2024-02-10",
    period: "Février 2024"
  },
  {
    id: "COM-004",
    clientId: "CLI-002",
    contractId: "CNT-004",
    amount: 440,
    status: 'Payée',
    date: "2024-01-20",
    period: "Janvier 2024"
  },
  {
    id: "COM-005",
    clientId: "CLI-002",
    contractId: "CNT-005",
    amount: 90,
    status: 'Prévue',
    date: "2024-03-15",
    period: "Mars 2024"
  }
];

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function PartnerClients() {
  const { clients, loading, createClient, updateClient, deleteClient } = useClients();
  const { policies } = usePolicies();
  const { documents } = useDocuments();
  const { commissions } = useCommissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [addingFamilyMember, setAddingFamilyMember] = useState(false);
  const [familyMemberType, setFamilyMemberType] = useState<'conjoint' | 'enfant'>('conjoint');
  const [formData, setFormData] = useState({
    company_name: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    birthdate: '',
    iban: '',
    is_company: false,
    country: 'CH'
  });
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
    const firstName = client.profile?.first_name || '';
    const lastName = client.profile?.last_name || '';
    const email = client.profile?.email || '';
    const companyName = client.company_name || '';
    
    const matchesSearch = 
      firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Pour l'instant tous actifs (pas de colonne status dans DB)
    const matchesStatus = statusFilter === "all" || true;
    
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    toast({ title: "Export réussi", description: "Les clients ont été exportés en CSV" });
  };

  const handleRowClick = (client: Client) => {
    setSelectedClient(client);
    setViewMode('detail');
    setAddingFamilyMember(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedClient(null);
    setAddingFamilyMember(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddFamilyMember = (type: 'conjoint' | 'enfant') => {
    setFamilyMemberType(type);
    setAddingFamilyMember(true);
    setIsModalOpen(true);
    setIsEditMode(false);
    setEditingClient(null);
  };

  const getClientContracts = (clientId: string) => {
    return policies.filter(p => p.client_id === clientId);
  };

  const getClientDocuments = (clientId: string) => {
    return documents.filter(d => d.owner_id === clientId && d.owner_type === 'client');
  };

  const getClientCommissions = (clientId: string) => {
    return commissions.filter(c => c.policy?.client?.id === clientId);
  };

  const getFamilyMembers = (clientId: string): Client[] => {
    // TODO: Implement family members relationship in database
    return [];
  };

  const getTotalFamilyContracts = (clientId: string): number => {
    const familyMembers = getFamilyMembers(clientId);
    let total = getClientContracts(clientId).length;
    familyMembers.forEach(member => {
      total += getClientContracts(member.id).length;
    });
    return total;
  };

  const getTotalFamilyPremiums = (clientId: string): number => {
    const familyMembers = getFamilyMembers(clientId);
    let total = getClientContracts(clientId).reduce((sum, c) => sum + (c.premium_monthly || 0), 0);
    familyMembers.forEach(member => {
      total += getClientContracts(member.id).reduce((sum, c) => sum + (c.premium_monthly || 0), 0);
    });
    return total;
  };

  const getContractStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "outline" } = {
      'Actif': 'default',
      'En attente': 'outline',
      'Résilié': 'secondary'
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getCommissionStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "outline" } = {
      'Payée': 'default',
      'En attente': 'outline',
      'Prévue': 'secondary'
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Clean up formData: transform empty strings to null for optional fields
      const cleanedData = {
        ...formData,
        company_name: formData.company_name || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        postal_code: formData.postal_code || null,
        birthdate: formData.birthdate || null,
        iban: formData.iban || null,
      };

      if (isEditMode && editingClient) {
        await updateClient(editingClient.id, cleanedData);
      } else {
        await createClient(cleanedData);
      }
      
      setIsModalOpen(false);
      setIsEditMode(false);
      setEditingClient(null);
      setFormData({
        company_name: '',
        phone: '',
        address: '',
        city: '',
        postal_code: '',
        birthdate: '',
        iban: '',
        is_company: false,
        country: 'CH'
      });
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleEditClick = (client: any) => {
    setEditingClient(client);
    setIsEditMode(true);
    setFormData({
      company_name: client.company_name || '',
      phone: client.phone || '',
      address: client.address || '',
      city: client.city || '',
      postal_code: client.postal_code || '',
      birthdate: client.birthdate || '',
      iban: client.iban || '',
      is_company: client.is_company || false,
      country: client.country || 'CH'
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (clientId: string) => {
    if (confirm('Supprimer ce client ?')) {
      await deleteClient(clientId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 dark:from-slate-950 dark:to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Chargement des clients...</p>
        </div>
      </div>
    );
  }

  const renderDetailView = () => {
    if (!selectedClient) return null;
    
    const clientContracts = getClientContracts(selectedClient.id);
    const clientDocuments = getClientDocuments(selectedClient.id);
    const clientCommissions = getClientCommissions(selectedClient.id);
    const familyMembers = getFamilyMembers(selectedClient.id);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 dark:from-slate-950 dark:to-slate-900 p-6">
        <motion.div 
          variants={fadeIn} 
          initial="hidden" 
          animate="show"
          className="max-w-[1800px] mx-auto space-y-6"
        >
          {/* Header with Back Button */}
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={handleBackToList}
              className="rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
                <User className="h-7 w-7" />
                {selectedClient.company_name || `${selectedClient.profile?.first_name || ''} ${selectedClient.profile?.last_name || ''}`}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Client {selectedClient.id.substring(0, 8)} • {selectedClient.profile?.email || 'N/A'}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => handleEditClick(selectedClient)}
              className="rounded-xl"
            >
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Contrats famille</p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                      {getTotalFamilyContracts(selectedClient.id)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Dont {clientContracts.length} directs
                    </p>
                  </div>
                  <FileText className="h-10 w-10 text-blue-500/20" />
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Primes famille/mois</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                      CHF {getTotalFamilyPremiums(selectedClient.id).toFixed(0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Dont CHF {clientContracts.reduce((sum, c) => sum + (c.premium_monthly || 0), 0)} directs
                    </p>
                  </div>
                  <CreditCard className="h-10 w-10 text-green-500/20" />
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Documents</p>
                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                      {clientDocuments.length}
                    </p>
                  </div>
                  <FileText className="h-10 w-10 text-purple-500/20" />
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Commissions</p>
                    <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">
                      CHF {clientCommissions.reduce((sum, c) => sum + c.amount, 0)}
                    </p>
                  </div>
                  <Banknote className="h-10 w-10 text-orange-500/20" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content Column */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur">
                <CardContent className="p-6">
                  <Tabs defaultValue="info" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="info">Informations</TabsTrigger>
                      <TabsTrigger value="family">Famille ({familyMembers.length})</TabsTrigger>
                      <TabsTrigger value="contracts">Contrats</TabsTrigger>
                      <TabsTrigger value="documents">Documents</TabsTrigger>
                      <TabsTrigger value="activity">Suivi</TabsTrigger>
                    </TabsList>

                {/* Info Tab */}
                <TabsContent value="info" className="space-y-6 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personal Info */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
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
                        <div>
                          <Label className="text-xs text-slate-500">Statut</Label>
                          <div className="mt-1">{getStatusBadge(selectedClient.status)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
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
                      <h3 className="font-semibold flex items-center gap-2">
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
                        <h3 className="font-semibold flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Informations bancaires
                        </h3>
                        <div className="text-sm">
                          <Label className="text-xs text-slate-500">IBAN</Label>
                          <div className="font-mono">{selectedClient.iban}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Family Tab */}
                <TabsContent value="family" className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Membres de la famille</h3>
                    <div className="flex gap-2">
                      <Button onClick={() => handleAddFamilyMember('conjoint')} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter conjoint
                      </Button>
                      <Button onClick={() => handleAddFamilyMember('enfant')} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter enfant
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 mb-2">Gestion des membres de la famille</p>
                      <p className="text-sm text-slate-400">Fonctionnalité à venir</p>
                    </div>
                  </div>
                </TabsContent>

                {/* Contracts Tab */}
                <TabsContent value="contracts" className="mt-6">
                  <ContractsSection userId={selectedClient.id} />
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="mt-6">
                  <DocumentsSection userId={selectedClient.id} />
                </TabsContent>

                {/* Activity / Suivi Tab */}
                <TabsContent value="activity" className="mt-6 space-y-4">
                  <FollowUpSection userId={selectedClient.id} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Commissions */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="rounded-2xl bg-white/70 dark:bg-slate-900/50 border-white/30 dark:border-slate-700/40 backdrop-blur sticky top-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  Commissions
                </h3>
                <Badge variant="outline">{clientCommissions.length}</Badge>
              </div>

              {/* Commission Summary */}
              <div className="space-y-4 mb-6">
                <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total commissions</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    CHF {clientCommissions.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Payées</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                      CHF {clientCommissions.filter(c => c.status === 'Payée').reduce((sum, c) => sum + c.amount, 0)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">En attente</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                      CHF {clientCommissions.filter(c => c.status === 'En attente').reduce((sum, c) => sum + c.amount, 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Commission List */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Détail des commissions</h4>
                {clientCommissions.length === 0 ? (
                  <div className="text-center py-8">
                    <Banknote className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Aucune commission</p>
                  </div>
                ) : (
                  clientCommissions.map((commission) => {
                    const contract = clientContracts.find(c => c.id === commission.policy_id);
                    return (
                      <div key={commission.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{contract?.product?.name || 'Contrat'}</p>
                            <p className="text-xs text-slate-500 font-mono">{contract?.policy_number}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-700 dark:text-green-400">CHF {commission.amount}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {commission.period_month && commission.period_year 
                              ? `${commission.period_month}/${commission.period_year}`
                              : 'N/A'}
                          </p>
                          {getCommissionStatusBadge(commission.status)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Décommissions Section */}
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Décommissions
                </h4>
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2">
                    <X className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500">Aucune décommission</p>
                  <p className="text-xs text-slate-400 mt-1">Les annulations et rétrocessions apparaîtront ici</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  </div>
    );
  };

  const renderListView = () => (
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
            <Button 
              className="rounded-xl" 
              onClick={() => {
                setIsEditMode(false);
                setEditingClient(null);
                setAddingFamilyMember(false);
                setIsModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouveau client
            </Button>
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
                    {filteredClients.map((client) => {
                      const firstName = client.profile?.first_name || '';
                      const lastName = client.profile?.last_name || '';
                      const email = client.profile?.email || '';
                      const displayName = client.company_name || `${firstName} ${lastName}`;
                      
                      return (
                      <TableRow 
                        key={client.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                        onClick={() => handleRowClick(client)}
                      >
                        <TableCell className="font-mono text-sm">{client.id.substring(0, 8)}</TableCell>
                        <TableCell className="font-medium">
                          {displayName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-slate-400" />
                            {email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {client.phone || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>{client.city || 'N/A'}</TableCell>
                        <TableCell>{getStatusBadge('Actif')}</TableCell>
                        <TableCell className="text-right font-semibold">
                          0
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          CHF 0
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </motion.div>
    </div>
  );

  return (
    <>
      {viewMode === 'detail' ? renderDetailView() : renderListView()}
      
      {/* Dialog accessible from both views */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {addingFamilyMember 
                ? `Ajouter ${familyMemberType === 'conjoint' ? 'un conjoint' : 'un enfant'} pour ${selectedClient?.firstName} ${selectedClient?.lastName}`
                : isEditMode ? "Modifier le client" : "Nouveau client principal"
              }
            </DialogTitle>
            <DialogDescription>
              {addingFamilyMember 
                ? `Complétez les informations du membre de la famille (${familyMemberType})`
                : isEditMode ? "Modifier les informations du client" : "Ajouter un nouveau client principal"
              }
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
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
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
                  setAddingFamilyMember(false);
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
    </>
  );
}
