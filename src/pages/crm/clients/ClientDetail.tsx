import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useClients, Client } from "@/hooks/useClients";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { usePolicies, Policy } from "@/hooks/usePolicies";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Plus, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import FamilyMemberForm from "@/components/crm/FamilyMemberForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const { getClientById } = useClients();
  const { familyMembers, loading: familyLoading } = useFamilyMembers(id);
  const { policies, loading: policiesLoading } = usePolicies();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [familyFormOpen, setFamilyFormOpen] = useState(false);

  // Filter policies for this client
  const clientPolicies = policies.filter(p => p.client_id === id);

  useEffect(() => {
    loadClient();
  }, [id]);

  const loadClient = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await getClientById(id);
    setClient(data);
    setLoading(false);
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
                <CardHeader>
                  <CardTitle>Contrats ({clientPolicies.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {policiesLoading ? (
                    <p className="text-muted-foreground text-center py-8">Chargement...</p>
                  ) : clientPolicies.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Aucun contrat pour ce client</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead>Compagnie</TableHead>
                          <TableHead>N° Police</TableHead>
                          <TableHead>Prime mensuelle</TableHead>
                          <TableHead>Date début</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientPolicies.map((policy) => (
                          <TableRow key={policy.id}>
                            <TableCell className="font-medium">{policy.product?.name || '-'}</TableCell>
                            <TableCell>{policy.product?.company?.name || '-'}</TableCell>
                            <TableCell>{policy.policy_number || '-'}</TableCell>
                            <TableCell>{policy.premium_monthly ? `${policy.premium_monthly} CHF` : '-'}</TableCell>
                            <TableCell>
                              {policy.start_date
                                ? format(new Date(policy.start_date), "dd.MM.yyyy")
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`${policyStatusColors[policy.status] || 'bg-gray-500'} text-white`}
                              >
                                {policyStatusLabels[policy.status] || policy.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardHeader>
                  <CardTitle>Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Aucun document pour le moment</p>
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
    </div>
  );
}
