import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useClients, Client } from "@/hooks/useClients";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { usePolicies, Policy } from "@/hooks/usePolicies";
import { useDocuments, Document } from "@/hooks/useDocuments";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Plus, Users, FileCheck, FileText, Download, Trash2, Upload, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import FamilyMemberForm from "@/components/crm/FamilyMemberForm";
import ContractForm from "@/components/crm/ContractForm";
import DocumentUpload, { docKindOptions } from "@/components/crm/DocumentUpload";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

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
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "info";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getClientById } = useClients();
  const { familyMembers, loading: familyLoading } = useFamilyMembers(id);
  const { policies, loading: policiesLoading } = usePolicies();
  const { createDocument, deleteDocument } = useDocuments();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [familyFormOpen, setFamilyFormOpen] = useState(false);
  const [contractFormOpen, setContractFormOpen] = useState(false);
  const [clientDocuments, setClientDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  // Filter policies for this client
  const clientPolicies = policies.filter(p => p.client_id === id);

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

  // Reload documents when policies change
  useEffect(() => {
    if (id && policies.length > 0) {
      loadDocuments();
    }
  }, [policies, id]);

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
        <Button onClick={() => navigate(`/crm/clients/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Modifier
        </Button>
      </div>

      <div className="grid gap-6">
        <div>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList>
              <TabsTrigger value="info">Informations</TabsTrigger>
              <TabsTrigger value="family">
                <Users className="h-4 w-4 mr-2" />
                Famille ({familyMembers.length})
              </TabsTrigger>
              <TabsTrigger value="contracts">Contrats ({clientPolicies.length})</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle>Informations personnelles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium capitalize">{client.type_adresse || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">État civil</p>
                      <p className="font-medium capitalize">{client.civil_status || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Nationalité</p>
                      <p className="font-medium">{client.nationality || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Permis</p>
                      <p className="font-medium">{client.permit_type ? `Permis ${client.permit_type}` : "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Profession</p>
                      <p className="font-medium">{client.profession || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Employeur</p>
                      <p className="font-medium">{client.employer || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{client.email || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Téléphone</p>
                      <p className="font-medium">{client.phone || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Mobile</p>
                      <p className="font-medium">{client.mobile || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Date de naissance</p>
                      <p className="font-medium">
                        {client.birthdate
                          ? format(new Date(client.birthdate), "dd MMMM yyyy", { locale: fr })
                          : "-"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Adresse</p>
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
                      <p className="text-sm text-muted-foreground">IBAN</p>
                      <p className="font-medium">{client.iban || "-"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Banque</p>
                      <p className="font-medium">{client.bank_name || "-"}</p>
                    </div>
                    {client.assigned_agent && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Agent assigné</p>
                        <p className="font-medium">
                          {client.assigned_agent.first_name && client.assigned_agent.last_name
                            ? `${client.assigned_agent.first_name} ${client.assigned_agent.last_name}`
                            : client.assigned_agent.email}
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Date de création</p>
                      <p className="font-medium">
                        {format(new Date(client.created_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="family">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Membres de la famille</CardTitle>
                  <Button onClick={() => setFamilyFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un membre
                  </Button>
                </CardHeader>
                <CardContent>
                  {familyLoading ? (
                    <p className="text-muted-foreground text-center py-8">Chargement...</p>
                  ) : familyMembers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Aucun membre de la famille enregistré
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Prénom</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>Date de naissance</TableHead>
                          <TableHead>Relation</TableHead>
                          <TableHead>Permis</TableHead>
                          <TableHead>Nationalité</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {familyMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>{member.first_name}</TableCell>
                            <TableCell>{member.last_name}</TableCell>
                            <TableCell>
                              {member.birth_date
                                ? new Date(member.birth_date).toLocaleDateString("fr-CH")
                                : "-"}
                            </TableCell>
                            <TableCell className="capitalize">{member.relation_type}</TableCell>
                            <TableCell>{member.permit_type || "-"}</TableCell>
                            <TableCell>{member.nationality || "-"}</TableCell>
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
                  <CardTitle>Contrats ({clientPolicies.length})</CardTitle>
                  <Button onClick={() => setContractFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau contrat
                  </Button>
                </CardHeader>
                <CardContent>
                  {policiesLoading ? (
                    <p className="text-muted-foreground text-center py-8">Chargement...</p>
                  ) : clientPolicies.length === 0 ? (
                    <div className="text-center py-8">
                      <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground">Aucun contrat pour ce client</p>
                      <Button className="mt-4" onClick={() => setContractFormOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter un contrat
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {clientPolicies.map((policy) => {
                        const category = policy.product?.category;
                        const notes = policy.notes || '';
                        
                        // Parse health details from notes
                        const lamalMatch = notes.match(/LAMal:\s*([\d.]+)\s*CHF/);
                        const lcaMatch = notes.match(/LCA:\s*([\d.]+)\s*CHF/);
                        const lamalAmount = lamalMatch ? parseFloat(lamalMatch[1]) : null;
                        const lcaAmount = lcaMatch ? parseFloat(lcaMatch[1]) : null;
                        
                        // Parse life duration from notes
                        const durationMatch = notes.match(/Durée:\s*(\d+)\s*ans/);
                        const durationYears = durationMatch ? parseInt(durationMatch[1]) : null;
                        
                        return (
                          <div key={policy.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{policy.product?.name || '-'}</span>
                                  <Badge
                                    variant="outline"
                                    className={`${policyStatusColors[policy.status] || 'bg-gray-500'} text-white text-xs`}
                                  >
                                    {policyStatusLabels[policy.status] || policy.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {policy.product?.company?.name} • {policy.policy_number || 'Sans numéro'}
                                </p>
                              </div>
                              <div className="text-right text-sm">
                                <p className="text-muted-foreground">Début</p>
                                <p className="font-medium">
                                  {policy.start_date ? format(new Date(policy.start_date), "dd.MM.yyyy") : "-"}
                                </p>
                              </div>
                            </div>
                            
                            {/* Category-specific details */}
                            {category === 'health' && (lamalAmount !== null || lcaAmount !== null) && (
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
                                      {policy.premium_monthly ? `${policy.premium_monthly} CHF` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Franchise</p>
                                    <p className="font-semibold">
                                      {policy.deductible ? `${policy.deductible} CHF` : '-'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {category === 'life' && (
                              <div className="mt-3 p-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Prime mensuelle</p>
                                    <p className="font-semibold text-violet-700 dark:text-violet-400">
                                      {policy.premium_monthly ? `${policy.premium_monthly} CHF` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Prime annuelle</p>
                                    <p className="font-semibold text-violet-700 dark:text-violet-400">
                                      {policy.premium_yearly ? `${policy.premium_yearly} CHF` : '-'}
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
                            
                            {category && !['health', 'life'].includes(category) && (
                              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Prime mensuelle</p>
                                    <p className="font-semibold text-blue-700 dark:text-blue-400">
                                      {policy.premium_monthly ? `${policy.premium_monthly} CHF` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Prime annuelle</p>
                                    <p className="font-semibold text-blue-700 dark:text-blue-400">
                                      {policy.premium_yearly ? `${policy.premium_yearly} CHF` : '-'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Franchise</p>
                                    <p className="font-semibold">
                                      {policy.deductible ? `${policy.deductible} CHF` : '-'}
                                    </p>
                                  </div>
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
        onSuccess={loadDocuments}
      />
    </div>
  );
}
