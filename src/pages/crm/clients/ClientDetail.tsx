import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useClients, Client } from "@/hooks/useClients";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { usePolicies, Policy } from "@/hooks/usePolicies";
import { useDocuments, Document } from "@/hooks/useDocuments";
import { useSuivis, Suivi, suiviTypeLabels, suiviStatusLabels, suiviStatusColors } from "@/hooks/useSuivis";
import { useCommissions, Commission } from "@/hooks/useCommissions";
import { useCommissionParts, CommissionPart } from "@/hooks/useCommissionParts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Plus, Users, FileCheck, FileText, Download, Trash2, Upload, Eye, ClipboardList, Clock, CheckCircle2, AlertCircle, MoreHorizontal, XCircle, RotateCcw, Calendar, DollarSign, ChevronDown, ChevronRight, UserCircle, Percent, FileSignature, Mail, UserPlus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import FamilyMemberForm from "@/components/crm/FamilyMemberForm";
import ContractForm from "@/components/crm/ContractForm";
import SuiviForm from "@/components/crm/SuiviForm";
import DocumentUpload, { docKindOptions } from "@/components/crm/DocumentUpload";
import ReserveAccountCard from "@/components/crm/ReserveAccountCard";
import MandatGestionForm from "@/components/crm/MandatGestionForm";
import SendEmailDialog from "@/components/crm/SendEmailDialog";
import { UserAvatar } from "@/components/crm/UserAvatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
const statusColors: Record<string, string> = {
  prospect: "bg-blue-500",
  actif: "bg-green-500",
  résilié: "bg-gray-500",
  dormant: "bg-orange-500",
};

const statusLabels: Record<string, string> = {
  prospect: "Prospect",
  actif: "Actif",
  résilié: "Résilié",
  dormant: "Dormant",
};

const policyStatusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  active: "bg-green-500",
  expired: "bg-gray-500",
  cancelled: "bg-red-500",
};

const policyStatusLabels: Record<string, string> = {
  pending: "En attente",
  active: "Actif",
  expired: "Expiré",
  cancelled: "Annulé",
};

export default function ClientDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "info";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getClientById } = useClients();
  const { familyMembers, loading: familyLoading } = useFamilyMembers(id);
  const { policies, loading: policiesLoading, fetchPolicies, deletePolicy } = usePolicies();
  const { createDocument, deleteDocument } = useDocuments();
  const { suivis, loading: suivisLoading, stats: suiviStats, fetchSuivis, closeSuivi, reopenSuivi, deleteSuivi } = useSuivis(id);
  const { commissions, loading: commissionsLoading, fetchCommissions, markAsPaid, deleteCommission } = useCommissions();
  const { fetchCommissionParts, deleteCommissionPart } = useCommissionParts();
  const { hasModule } = usePlanFeatures();
  
  // Check plan modules
  const hasClientPortal = hasModule('client_portal');
  const hasMandateAutomation = hasModule('mandate_automation');
  
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [familyFormOpen, setFamilyFormOpen] = useState(false);
  const [contractFormOpen, setContractFormOpen] = useState(false);
  const [editContractOpen, setEditContractOpen] = useState(false);
  const [editPolicyId, setEditPolicyId] = useState<string | null>(null);
  const [clientDocuments, setClientDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<string | null>(null);
  const [suiviFormOpen, setSuiviFormOpen] = useState(false);
  const [editSuiviOpen, setEditSuiviOpen] = useState(false);
  const [editSuivi, setEditSuivi] = useState<Suivi | null>(null);
  const [deleteSuiviConfirmOpen, setDeleteSuiviConfirmOpen] = useState(false);
  const [suiviToDelete, setSuiviToDelete] = useState<string | null>(null);
  const [expandedCommissions, setExpandedCommissions] = useState<Record<string, boolean>>({});
  const [commissionParts, setCommissionParts] = useState<Record<string, CommissionPart[]>>({});
  const [loadingParts, setLoadingParts] = useState<Record<string, boolean>>({});
  const [creatingClientAccount, setCreatingClientAccount] = useState(false);
  const [clientAccountDialogOpen, setClientAccountDialogOpen] = useState(false);
  const [clientPassword, setClientPassword] = useState("");

  // Filter policies for this client
  const clientPolicies = policies.filter(p => p.client_id === id);
  
  // Filter commissions for this client's policies
  const clientCommissions = commissions.filter(c => 
    clientPolicies.some(p => p.id === c.policy_id)
  );

  useEffect(() => {
    loadClient();
    loadDocuments();
  }, [id]);

  const loadClient = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await getClientById(id);
    setClient(data);
    setLoading(false);
  };

  const loadDocuments = async () => {
    if (!id) return;
    setDocumentsLoading(true);
    try {
      // Get documents for this client and their policies
      const policyIds = policies.filter(p => p.client_id === id).map(p => p.id);
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .or(`owner_id.eq.${id},owner_id.in.(${policyIds.join(',')})`)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setClientDocuments(data as Document[]);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setDocumentsLoading(false);
    }
  };

  // Reload documents when policies load (only once per policy count change)
  useEffect(() => {
    if (id && !policiesLoading && policies.length > 0) {
      loadDocuments();
    }
  }, [policiesLoading, id]);

  const handleDocumentUpload = async (doc: { file_key: string; file_name: string; doc_kind: string; mime_type: string; size_bytes: number }) => {
    if (!id) return;
    try {
      await createDocument({
        owner_id: id,
        owner_type: 'client',
        file_key: doc.file_key,
        file_name: doc.file_name,
        doc_kind: doc.doc_kind,
        mime_type: doc.mime_type,
        size_bytes: doc.size_bytes,
      });
      await loadDocuments();
    } catch (error) {
      console.error('Error saving document:', error);
    }
  };

  const handleDocumentDelete = async (docId: string, fileKey: string) => {
    try {
      // Delete from storage
      await supabase.storage.from('documents').remove([fileKey]);
      // Delete record
      await deleteDocument(docId);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleDocumentView = async (fileKey: string) => {
    try {
      const { data } = await supabase.storage.from('documents').createSignedUrl(fileKey, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ouvrir le document",
        variant: "destructive",
      });
    }
  };

  const handleCreateClientAccount = async () => {
    if (!client || !client.email || !clientPassword) {
      toast({
        title: "Erreur",
        description: "Email du client et mot de passe requis",
        variant: "destructive",
      });
      return;
    }

    setCreatingClientAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const response = await supabase.functions.invoke('create-user-account', {
        body: {
          email: client.email,
          password: clientPassword,
          role: 'client',
          clientId: client.id,
          firstName: client.first_name,
          lastName: client.last_name,
        },
      });

      if (response.error) throw response.error;

      toast({
        title: "Compte créé",
        description: `Compte client créé pour ${client.email}`,
      });
      setClientAccountDialogOpen(false);
      setClientPassword("");
      loadClient(); // Reload to get updated user_id
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le compte",
        variant: "destructive",
      });
    } finally {
      setCreatingClientAccount(false);
    }
  };

  const handleDeletePolicy = async () => {
    if (!policyToDelete) return;
    try {
      await deletePolicy(policyToDelete);
      setDeleteConfirmOpen(false);
      setPolicyToDelete(null);
    } catch (error) {
      console.error('Error deleting policy:', error);
    }
  };

  const getDocKindLabel = (kind: string) => {
    return docKindOptions.find(o => o.value === kind)?.label || kind;
  };

  const getClientName = () => {
    if (!client) return "";
    if (client.company_name) return client.company_name;
    if (client.first_name || client.last_name) {
      return `${client.first_name || ""} ${client.last_name || ""}`.trim();
    }
    return "Sans nom";
  };

  const getTypeLabel = () => {
    if (!client?.type_adresse) return "";
    const labels: Record<string, string> = {
      client: "Client",
      collaborateur: "Collaborateur",
      partenaire: "Partenaire",
    };
    return labels[client.type_adresse] || "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/crm/clients")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Adresse non trouvée</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/crm/clients")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <UserAvatar
            firstName={client.first_name}
            lastName={client.last_name}
            gender={(client as any).gender}
            photoUrl={(client as any).photo_url}
            size="xl"
          />
          <div>
            <h1 className="text-3xl font-bold">{getClientName()}</h1>
            <div className="flex items-center gap-2 mt-1">
              {client.type_adresse && (
                <Badge variant="outline">
                  {getTypeLabel()}
                </Badge>
              )}
              {client.status && (
                <Badge
                  variant="outline"
                  className={`${statusColors[client.status]} text-white`}
                >
                  {statusLabels[client.status] || client.status}
                </Badge>
              )}
              {client.tags && client.tags.length > 0 && (
                <>
                  {client.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Bouton créer compte client - uniquement si pas de user_id, type client, et module client_portal actif */}
          {hasClientPortal && client.type_adresse === 'client' && !client.user_id && client.email && (
            <Button 
              variant="outline" 
              onClick={() => setClientAccountDialogOpen(true)}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {t('clientDetail.createClientSpace')}
            </Button>
          )}
          {hasClientPortal && client.user_id && client.type_adresse === 'client' && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t('clientDetail.clientSpaceActive')}
            </Badge>
          )}
          <SendEmailDialog
            clientEmail={client.email || ""}
            clientName={getClientName()}
            disabled={!client.email}
          />
          <Button onClick={() => navigate(`/crm/clients/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            {t('common.edit')}
          </Button>
        </div>
      </div>

      {/* Dialog pour créer un compte client */}
      <Dialog open={clientAccountDialogOpen} onOpenChange={setClientAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un espace client</DialogTitle>
            <DialogDescription>
              Créer un compte pour permettre à {getClientName()} d'accéder à son espace client Advisy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={client.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientPassword">Mot de passe temporaire</Label>
              <Input
                id="clientPassword"
                type="password"
                value={clientPassword}
                onChange={(e) => setClientPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientAccountDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleCreateClientAccount} 
              disabled={creatingClientAccount || clientPassword.length < 6}
            >
              {creatingClientAccount ? "Création..." : "Créer le compte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6">
        <div>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="info">{t('clientDetail.personalInfo')}</TabsTrigger>
              <TabsTrigger value="family">
                <Users className="h-4 w-4 mr-2" />
                {t('clientDetail.family')} ({familyMembers.length})
              </TabsTrigger>
              <TabsTrigger value="contracts">{t('clientDetail.contracts')} ({clientPolicies.length})</TabsTrigger>
              <TabsTrigger value="documents">{t('clientDetail.documents')}</TabsTrigger>
              <TabsTrigger value="suivis">
                <ClipboardList className="h-4 w-4 mr-2" />
                {t('clientDetail.followups')}
              </TabsTrigger>
              <TabsTrigger value="commissions">
                <DollarSign className="h-4 w-4 mr-2" />
                {t('clientDetail.commissions')} ({clientCommissions.length})
              </TabsTrigger>
              {hasMandateAutomation && (
                <TabsTrigger value="mandat">
                  <FileSignature className="h-4 w-4 mr-2" />
                  {t('clientDetail.mandate')}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle>{t('clientDetail.personalInfo')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.type')}</p>
                      <p className="font-medium capitalize">{client.type_adresse || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.civilStatus')}</p>
                      <p className="font-medium capitalize">{client.civil_status || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.nationality')}</p>
                      <p className="font-medium">{client.nationality || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.permit')}</p>
                      <p className="font-medium">{client.permit_type ? `${t('clientDetail.permit')} ${client.permit_type}` : "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.profession')}</p>
                      <p className="font-medium">{client.profession || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.employer')}</p>
                      <p className="font-medium">{client.employer || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.email')}</p>
                      <p className="font-medium">{client.email || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.phone')}</p>
                      <p className="font-medium">{client.phone || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.mobile')}</p>
                      <p className="font-medium">{client.mobile || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.birthdate')}</p>
                      <p className="font-medium">
                        {client.birthdate
                          ? format(new Date(client.birthdate), "dd MMMM yyyy", { locale: fr })
                          : "-"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.address')}</p>
                      <p className="font-medium">
                        {[
                          client.address,
                          [client.zip_code, client.city].filter(Boolean).join(" "),
                          client.country,
                        ]
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.iban')}</p>
                      <p className="font-medium">{client.iban || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.bank')}</p>
                      <p className="font-medium">{client.bank_name || "-"}</p>
                    </div>
                    {client.assigned_agent && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">{t('clientDetail.assignedAgent')}</p>
                        <p className="font-medium">
                          {client.assigned_agent.first_name && client.assigned_agent.last_name
                            ? `${client.assigned_agent.first_name} ${client.assigned_agent.last_name}`
                            : client.assigned_agent.email}
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t('clientDetail.createdAt')}</p>
                      <p className="font-medium">
                        {format(new Date(client.created_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                  </div>
                  
                  {/* Section spéciale pour les collaborateurs - Taux et commissions */}
                  {client.type_adresse === 'collaborateur' && (
                    <div className="mt-8 pt-6 border-t">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Percent className="h-5 w-5 text-primary" />
                        {t('clientDetail.remunerationReserve')}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-xl">
                          <p className="text-sm text-muted-foreground">{t('clientDetail.lcaRate')}</p>
                          <p className="text-2xl font-bold text-blue-600">{client.commission_rate_lca || 0}%</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-xl">
                          <p className="text-sm text-muted-foreground">{t('clientDetail.vieRate')}</p>
                          <p className="text-2xl font-bold text-purple-600">{client.commission_rate_vie || 0}%</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-xl">
                          <p className="text-sm text-muted-foreground">{t('clientDetail.reserveRate')}</p>
                          <p className="text-2xl font-bold text-orange-600">{client.reserve_rate || 0}%</p>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-xl">
                          <p className="text-sm text-muted-foreground">{t('clientDetail.fixedSalary')}</p>
                          <p className="text-2xl font-bold text-emerald-600">
                            {client.fixed_salary 
                              ? new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(client.fixed_salary)
                              : 'CHF 0.00'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Compte de réserve - simulation basée sur les commissions */}
                      {client.reserve_rate && client.reserve_rate > 0 && (
                        <ReserveAccountCard clientId={client.id} reserveRate={client.reserve_rate} />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="family">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{t('clientDetail.familyMembers')}</CardTitle>
                  <Button onClick={() => setFamilyFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('clientDetail.addFamilyMember')}
                  </Button>
                </CardHeader>
                <CardContent>
                  {familyLoading ? (
                    <p className="text-muted-foreground text-center py-8">{t('clientDetail.loading')}</p>
                  ) : familyMembers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      {t('clientDetail.noFamilyMembers')}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('clientDetail.firstName')}</TableHead>
                          <TableHead>{t('clientDetail.lastName')}</TableHead>
                          <TableHead>{t('clientDetail.birthdate')}</TableHead>
                          <TableHead>{t('clientDetail.relation')}</TableHead>
                          <TableHead>{t('clientDetail.permit')}</TableHead>
                          <TableHead>{t('clientDetail.nationality')}</TableHead>
                          <TableHead>{t('clientDetail.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {familyMembers.map((member) => (
                          <TableRow key={member.id} className="cursor-pointer hover:bg-muted/50">
                            <TableCell>{member.first_name}</TableCell>
                            <TableCell>{member.last_name}</TableCell>
                            <TableCell>
                              {member.birth_date
                                ? new Date(member.birth_date).toLocaleDateString("fr-CH")
                                : "-"}
                            </TableCell>
                            <TableCell className="capitalize">
                              {member.relation_type}
                              {member.is_reverse_relation && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {t('clientDetail.family')}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{member.permit_type || "-"}</TableCell>
                            <TableCell>{member.nationality || "-"}</TableCell>
                            <TableCell>
                              {member.linked_client_id ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/crm/clients/${member.linked_client_id}`)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  {t('clientDetail.view')}
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    // Find the client by name
                                    const { data } = await supabase
                                      .from('clients')
                                      .select('id')
                                      .ilike('first_name', member.first_name)
                                      .ilike('last_name', member.last_name)
                                      .maybeSingle();
                                    if (data?.id) {
                                      navigate(`/crm/clients/${data.id}`);
                                    } else {
                                      toast({
                                        title: t('common.info'),
                                        description: t('clientDetail.noFamilyMembers'),
                                      });
                                    }
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  {t('clientDetail.view')}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contracts">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{t('clientDetail.contracts')} ({clientPolicies.length})</CardTitle>
                  <Button onClick={() => setContractFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('clientDetail.newContract')}
                  </Button>
                </CardHeader>
                <CardContent>
                  {policiesLoading ? (
                    <p className="text-muted-foreground text-center py-8">{t('clientDetail.loading')}</p>
                  ) : clientPolicies.length === 0 ? (
                    <div className="text-center py-8">
                      <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground">{t('clientDetail.noContractForClient')}</p>
                      <Button className="mt-4" onClick={() => setContractFormOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('clientDetail.addFirstContract')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {clientPolicies.map((policy) => {
                        const category = policy.product?.category;
                        const notes = policy.notes || '';
                        
                        // Get products_data from policy
                        const productsData = policy.products_data || [];
                        const hasMultipleProducts = productsData.length > 1;
                        
                        // Parse health details from notes (flexible regex) - fallback for old contracts
                        const lamalMatch = notes.match(/LAMal[:\s]*([\d.,]+)\s*CHF/i);
                        const lcaMatch = notes.match(/LCA[:\s]*([\d.,]+)\s*CHF/i);
                        const franchiseMatch = notes.match(/Franchise[:\s]*([\d.,]+)\s*CHF/i);
                        const lamalAmount = lamalMatch ? parseFloat(lamalMatch[1].replace(',', '.')) : null;
                        const lcaAmount = lcaMatch ? parseFloat(lcaMatch[1].replace(',', '.')) : null;
                        const franchiseFromNotes = franchiseMatch ? parseFloat(franchiseMatch[1].replace(',', '.')) : null;
                        
                        // Parse life duration from notes
                        const durationMatch = notes.match(/Durée[:\s]*(\d+)\s*ans/i);
                        const durationYears = durationMatch ? parseInt(durationMatch[1]) : null;
                        
                        // Use deductible from field, parsed from notes, or from products_data
                        let displayDeductible = policy.deductible || franchiseFromNotes;
                        
                        // If no deductible found yet, try to get it from products_data
                        if (!displayDeductible && productsData.length > 0) {
                          // Find first product with a deductible
                          const productWithDeductible = productsData.find((p: any) => p.deductible && p.deductible > 0);
                          if (productWithDeductible) {
                            displayDeductible = productWithDeductible.deductible;
                          }
                        }
                        
                        // Calculate totals from products_data
                        const totalFromProducts = productsData.reduce((sum: number, p: any) => sum + (p.premium || 0), 0);
                        
                        return (
                            <div key={policy.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">
                                    {hasMultipleProducts 
                                      ? `${t('clientDetail.multiProductContract')} (${productsData.length})`
                                      : (policy.product?.name || t('clientDetail.unknownProduct'))}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`${policyStatusColors[policy.status] || 'bg-gray-500'} text-white text-xs`}
                                  >
                                    {policyStatusLabels[policy.status] || policy.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {policy.product?.company?.name || policy.company_name || t('clientDetail.unknownCompany')} • {policy.policy_number || t('clientDetail.noNumber')}
                                </p>
                              </div>
                              <div className="flex items-start gap-4">
                                <div className="text-right text-sm">
                                  <p className="text-muted-foreground">{t('clientDetail.startDate')}</p>
                                  <p className="font-medium">
                                    {policy.start_date ? format(new Date(policy.start_date), "dd.MM.yyyy") : "-"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setEditPolicyId(policy.id);
                                      setEditContractOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => {
                                      setPolicyToDelete(policy.id);
                                      setDeleteConfirmOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Multi-products display */}
                            {hasMultipleProducts && (
                              <div className="mt-3 p-3 bg-primary/5 rounded-lg">
                                <h4 className="font-medium text-sm mb-2">{t('clientDetail.productsIncluded')}</h4>
                                <div className="space-y-2">
                                  {productsData.map((prod, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm p-2 bg-background rounded border">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          {prod.category === 'health' ? 'Santé' : 
                                           prod.category === 'life' ? 'Vie' :
                                           prod.category === 'auto' ? 'Auto' :
                                           prod.category === 'home' ? 'Ménage' :
                                           prod.category === 'legal' ? 'Juridique' : 'Autre'}
                                        </Badge>
                                        <span>{prod.name}</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="font-semibold">{prod.premium?.toFixed(2) || '0.00'} CHF/mois</span>
                                        {prod.deductible && (
                                          <span className="text-muted-foreground ml-2">(Fr. {prod.deductible} CHF)</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 pt-2 border-t flex justify-between items-center">
                                  <span className="font-semibold">Total mensuel</span>
                                  <span className="text-lg font-bold text-primary">
                                    {policy.premium_monthly ? Number(policy.premium_monthly).toFixed(2) : totalFromProducts.toFixed(2)} CHF
                                  </span>
                                </div>
                              </div>
                            )}
                            
                            {/* Single product - Health Insurance Details */}
                            {!hasMultipleProducts && category === 'health' && (
                              <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Prime LAMal</p>
                                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                                      {lamalAmount !== null ? `${lamalAmount.toFixed(2)} CHF/mois` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Prime LCA</p>
                                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                                      {lcaAmount !== null ? `${lcaAmount.toFixed(2)} CHF/mois` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Total mensuel</p>
                                    <p className="font-semibold">
                                      {policy.premium_monthly ? `${Number(policy.premium_monthly).toFixed(2)} CHF` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Franchise LAMal</p>
                                    <p className="font-semibold">
                                      {displayDeductible ? `${displayDeductible} CHF` : '-'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Single product - Life Insurance Details */}
                            {!hasMultipleProducts && category === 'life' && (
                              <div className="mt-3 p-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Prime mensuelle</p>
                                    <p className="font-semibold text-violet-700 dark:text-violet-400">
                                      {policy.premium_monthly ? `${Number(policy.premium_monthly).toFixed(2)} CHF` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Prime annuelle</p>
                                    <p className="font-semibold text-violet-700 dark:text-violet-400">
                                      {policy.premium_yearly ? `${Number(policy.premium_yearly).toFixed(2)} CHF` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Durée</p>
                                    <p className="font-semibold">
                                      {durationYears ? `${durationYears} ans` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Date de fin</p>
                                    <p className="font-semibold">
                                      {policy.end_date ? format(new Date(policy.end_date), "dd.MM.yyyy") : '-'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Single product - Other Insurance Types */}
                            {!hasMultipleProducts && category && !['health', 'life'].includes(category) && (
                              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Prime mensuelle</p>
                                    <p className="font-semibold text-blue-700 dark:text-blue-400">
                                      {policy.premium_monthly ? `${Number(policy.premium_monthly).toFixed(2)} CHF` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Prime annuelle</p>
                                    <p className="font-semibold text-blue-700 dark:text-blue-400">
                                      {policy.premium_yearly ? `${Number(policy.premium_yearly).toFixed(2)} CHF` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Franchise</p>
                                    <p className="font-semibold">
                                      {displayDeductible ? `${displayDeductible} CHF` : '-'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Fallback for contracts without category */}
                            {!hasMultipleProducts && !category && (
                              <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Prime mensuelle</p>
                                    <p className="font-semibold">
                                      {policy.premium_monthly ? `${Number(policy.premium_monthly).toFixed(2)} CHF` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Prime annuelle</p>
                                    <p className="font-semibold">
                                      {policy.premium_yearly ? `${Number(policy.premium_yearly).toFixed(2)} CHF` : '-'}
                                    </p>
                                  </div>
                                  {displayDeductible && (
                                    <div>
                                      <p className="text-muted-foreground">Franchise</p>
                                      <p className="font-semibold">{displayDeductible} CHF</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Documents ({clientDocuments.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Upload Section */}
                  <div className="p-4 bg-muted/30 rounded-lg border">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Ajouter un document
                    </h4>
                    <DocumentUpload
                      documents={[]}
                      onUpload={handleDocumentUpload}
                      showList={false}
                    />
                  </div>

                  {/* Documents List */}
                  {documentsLoading ? (
                    <p className="text-muted-foreground text-center py-8">Chargement...</p>
                  ) : clientDocuments.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground">Aucun document pour ce client</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom du fichier</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Date d'ajout</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientDocuments.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                {doc.file_name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getDocKindLabel(doc.doc_kind || 'autre')}</Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(doc.created_at), "dd.MM.yyyy HH:mm")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDocumentView(doc.file_key)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDocumentDelete(doc.id, doc.file_key)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="suivis">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Suivis et tâches
                  </CardTitle>
                  <Button onClick={() => setSuiviFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau suivi
                  </Button>
                </CardHeader>
                <CardContent>
                  {/* Stats mini cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-muted-foreground">Ouverts</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{suiviStats.ouverts}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <span className="text-sm text-muted-foreground">En cours</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-600">{suiviStats.en_cours}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm text-muted-foreground">Fermés</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">{suiviStats.fermes}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardList className="h-4 w-4 text-violet-600" />
                        <span className="text-sm text-muted-foreground">Total</span>
                      </div>
                      <p className="text-2xl font-bold text-violet-600">{suiviStats.total}</p>
                    </div>
                  </div>

                  {/* Suivis list */}
                  {suivisLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  ) : suivis.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                      <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground mb-2">Aucun suivi pour ce client</p>
                      <p className="text-sm text-muted-foreground/70 mb-4">
                        Ajoutez des notes, rappels et tâches de suivi
                      </p>
                      <Button onClick={() => setSuiviFormOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Créer un suivi
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Titre</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Date de rappel</TableHead>
                          <TableHead>Créé le</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {suivis.map((suivi) => (
                          <TableRow key={suivi.id}>
                            <TableCell className="font-medium">
                              {suivi.title}
                              {suivi.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {suivi.description}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              {suivi.type ? (
                                <Badge variant="outline">
                                  {suiviTypeLabels[suivi.type] || suivi.type}
                                </Badge>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${suiviStatusColors[suivi.status]} text-white`}>
                                {suiviStatusLabels[suivi.status] || suivi.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {suivi.reminder_date ? (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(suivi.reminder_date), "dd/MM/yyyy", { locale: fr })}
                                </span>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              {format(new Date(suivi.created_at), "dd/MM/yyyy", { locale: fr })}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setEditSuivi(suivi);
                                    setEditSuiviOpen(true);
                                  }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Modifier
                                  </DropdownMenuItem>
                                  {suivi.status !== "ferme" ? (
                                    <DropdownMenuItem onClick={() => closeSuivi(suivi.id)}>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Fermer le suivi
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => reopenSuivi(suivi.id)}>
                                      <RotateCcw className="h-4 w-4 mr-2" />
                                      Réouvrir
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => {
                                      setSuiviToDelete(suivi.id);
                                      setDeleteSuiviConfirmOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="commissions">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Commissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Commission stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm text-muted-foreground">Total</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">
                        {new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' })
                          .format(clientCommissions.reduce((sum, c) => sum + Number(c.amount || 0), 0))}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-amber-600" />
                        <span className="text-sm text-muted-foreground">À payer</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-600">
                        {new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' })
                          .format(clientCommissions.filter(c => c.status === 'due').reduce((sum, c) => sum + Number(c.amount || 0), 0))}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-muted-foreground">En attente</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">
                        {new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' })
                          .format(clientCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount || 0), 0))}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-muted-foreground">Payées</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        {new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' })
                          .format(clientCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount || 0), 0))}
                      </p>
                    </div>
                  </div>

                  {/* Commissions list */}
                  {commissionsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  ) : clientCommissions.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                      <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground mb-2">Aucune commission pour ce client</p>
                      <p className="text-sm text-muted-foreground/70">
                        Les commissions s'ajoutent depuis la page Commissions
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {clientCommissions.map((commission) => {
                        const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
                          due: { label: "À payer", color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
                          pending: { label: "En attente", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
                          paid: { label: "Payée", color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
                        };
                        const typeConfig: Record<string, { label: string }> = {
                          acquisition: { label: "Acquisition" },
                          renewal: { label: "Renouvellement" },
                          bonus: { label: "Bonus" },
                          gestion: { label: "Gestion" },
                        };
                        const status = statusConfig[commission.status] || statusConfig.pending;
                        const type = typeConfig[commission.type || 'acquisition'] || typeConfig.acquisition;
                        const isExpanded = expandedCommissions[commission.id] || false;
                        const parts = commissionParts[commission.id] || [];
                        const isLoadingParts = loadingParts[commission.id] || false;
                        
                        const toggleExpand = async () => {
                          const newExpanded = !isExpanded;
                          setExpandedCommissions(prev => ({ ...prev, [commission.id]: newExpanded }));
                          
                          if (newExpanded && !commissionParts[commission.id]) {
                            setLoadingParts(prev => ({ ...prev, [commission.id]: true }));
                            const fetchedParts = await fetchCommissionParts(commission.id);
                            setCommissionParts(prev => ({ ...prev, [commission.id]: fetchedParts }));
                            setLoadingParts(prev => ({ ...prev, [commission.id]: false }));
                          }
                        };
                        
                        const totalAssigned = parts.reduce((sum, p) => sum + Number(p.rate || 0), 0);

                        return (
                          <div key={commission.id} className="border rounded-lg overflow-hidden">
                            {/* Main commission row */}
                            <div 
                              className="p-4 bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={toggleExpand}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Button variant="ghost" size="sm" className="p-0 h-auto">
                                    {isExpanded ? (
                                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </Button>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-sm text-muted-foreground">
                                        {commission.policy?.policy_number || 'N/A'}
                                      </span>
                                      <Badge variant="outline">{type.label}</Badge>
                                      <Badge className={`${status.bgColor} ${status.color} border-0`}>
                                        {status.label}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {commission.policy?.product?.name || 'Produit inconnu'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-xl font-bold text-emerald-600">
                                      {new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' })
                                        .format(Number(commission.amount))}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {commission.date 
                                        ? format(new Date(commission.date), "dd MMM yyyy", { locale: fr })
                                        : format(new Date(commission.created_at), "dd MMM yyyy", { locale: fr })
                                      }
                                    </p>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {commission.status !== 'paid' && (
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); markAsPaid(commission.id); }}>
                                          <CheckCircle2 className="h-4 w-4 mr-2" />
                                          Marquer comme payée
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem 
                                        className="text-destructive"
                                        onClick={(e) => { e.stopPropagation(); deleteCommission(commission.id); }}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Supprimer
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                            
                            {/* Expanded section - Commission parts */}
                            {isExpanded && (
                              <div className="border-t bg-muted/30 p-4">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-medium flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Répartition de la commission
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={totalAssigned >= 100 ? "default" : "outline"} className={totalAssigned > 100 ? "bg-destructive" : ""}>
                                      <Percent className="h-3 w-3 mr-1" />
                                      {totalAssigned}% attribué
                                    </Badge>
                                  </div>
                                </div>
                                
                                {isLoadingParts ? (
                                  <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {/* Advisy part (remaining) */}
                                    {(() => {
                                      const advisyRate = Math.max(0, 100 - totalAssigned);
                                      const advisyAmount = (Number(commission.amount) * advisyRate) / 100;
                                      return (
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border-2 border-primary/20">
                                          <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                                              <span className="text-primary-foreground font-bold text-sm">A</span>
                                            </div>
                                            <div>
                                              <p className="font-semibold text-primary">Advisy</p>
                                              <p className="text-xs text-muted-foreground">Part de l'entreprise</p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className="font-bold text-primary text-lg">
                                              {new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' })
                                                .format(advisyAmount)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {advisyRate}% de la commission
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                    
                                    {/* Agent parts */}
                                    {parts.length === 0 ? (
                                      <div className="text-center py-4 border-2 border-dashed rounded-lg bg-background">
                                        <p className="text-sm text-muted-foreground">Aucun collaborateur assigné</p>
                                        <p className="text-xs text-muted-foreground/70 mt-1">
                                          100% revient à Advisy
                                        </p>
                                      </div>
                                    ) : (
                                      parts.map((part) => {
                                        const agentName = part.agent?.first_name && part.agent?.last_name
                                          ? `${part.agent.first_name} ${part.agent.last_name}`
                                          : part.agent?.email || 'Agent inconnu';
                                        
                                        return (
                                          <div 
                                            key={part.id} 
                                            className="flex items-center justify-between p-3 rounded-lg bg-background border"
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                                <UserCircle className="h-6 w-6 text-muted-foreground" />
                                              </div>
                                              <div>
                                                <p className="font-medium">{agentName}</p>
                                                <p className="text-xs text-muted-foreground">{part.agent?.email}</p>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                              <div className="text-right">
                                                <p className="font-semibold text-emerald-600">
                                                  {new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' })
                                                    .format(Number(part.amount))}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  {part.rate}% de la commission
                                                </p>
                                              </div>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={async () => {
                                                  await deleteCommissionPart(part.id);
                                                  const updatedParts = parts.filter(p => p.id !== part.id);
                                                  setCommissionParts(prev => ({ ...prev, [commission.id]: updatedParts }));
                                                }}
                                              >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                              </Button>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {hasMandateAutomation && (
              <TabsContent value="mandat">
                <MandatGestionForm client={client} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      <FamilyMemberForm
        clientId={id!}
        open={familyFormOpen}
        onOpenChange={setFamilyFormOpen}
      />

      <ContractForm
        clientId={id!}
        open={contractFormOpen}
        onOpenChange={setContractFormOpen}
        onSuccess={() => {
          fetchPolicies();
          loadDocuments();
        }}
      />

      {/* Edit Contract Form */}
      {editPolicyId && (
        <ContractForm
          clientId={id!}
          open={editContractOpen}
          onOpenChange={(open) => {
            setEditContractOpen(open);
            if (!open) setEditPolicyId(null);
          }}
          onSuccess={() => {
            fetchPolicies();
            loadDocuments();
            setEditPolicyId(null);
          }}
          editMode={true}
          policyId={editPolicyId}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le contrat et toutes ses données seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPolicyToDelete(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePolicy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suivi Form - Create */}
      <SuiviForm
        clientId={id!}
        open={suiviFormOpen}
        onOpenChange={setSuiviFormOpen}
        onSuccess={fetchSuivis}
      />

      {/* Suivi Form - Edit */}
      {editSuivi && (
        <SuiviForm
          clientId={id!}
          open={editSuiviOpen}
          onOpenChange={(open) => {
            setEditSuiviOpen(open);
            if (!open) setEditSuivi(null);
          }}
          onSuccess={fetchSuivis}
          editMode={true}
          suivi={editSuivi}
        />
      )}

      {/* Delete Suivi Confirmation Dialog */}
      <AlertDialog open={deleteSuiviConfirmOpen} onOpenChange={setDeleteSuiviConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce suivi ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le suivi sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSuiviToDelete(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                if (suiviToDelete) {
                  await deleteSuivi(suiviToDelete);
                  setDeleteSuiviConfirmOpen(false);
                  setSuiviToDelete(null);
                }
              }} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
