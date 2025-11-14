import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useClients, Client } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getClientById } = useClients();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

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
    return client.profile?.first_name && client.profile?.last_name
      ? `${client.profile.first_name} ${client.profile.last_name}`
      : "Sans nom";
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
          <h1 className="text-3xl font-bold">Client non trouvé</h1>
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
        <Button onClick={() => navigate(`/crm/clients/${id}/modifier`)}>
          <Edit className="h-4 w-4 mr-2" />
          Modifier
        </Button>
      </div>

      <Tabs defaultValue="infos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="suivis">Suivis</TabsTrigger>
          <TabsTrigger value="propositions">Propositions</TabsTrigger>
          <TabsTrigger value="contrats">Contrats</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="infos">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {client.company_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Entreprise</p>
                    <p className="font-medium">{client.company_name}</p>
                  </div>
                )}
                {(client.first_name || client.profile?.first_name) && (
                  <div>
                    <p className="text-sm text-muted-foreground">Prénom</p>
                    <p className="font-medium">
                      {client.first_name || client.profile?.first_name}
                    </p>
                  </div>
                )}
                {(client.last_name || client.profile?.last_name) && (
                  <div>
                    <p className="text-sm text-muted-foreground">Nom</p>
                    <p className="font-medium">
                      {client.last_name || client.profile?.last_name}
                    </p>
                  </div>
                )}
                {(client.email || client.profile?.email) && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">
                      {client.email || client.profile?.email}
                    </p>
                  </div>
                )}
                {client.mobile && (
                  <div>
                    <p className="text-sm text-muted-foreground">Mobile</p>
                    <p className="font-medium">{client.mobile}</p>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <p className="font-medium">{client.phone}</p>
                  </div>
                )}
                {client.birthdate && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Date de naissance
                    </p>
                    <p className="font-medium">
                      {format(new Date(client.birthdate), "dd MMMM yyyy", {
                        locale: fr,
                      })}
                    </p>
                  </div>
                )}
              </div>

              {client.address && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Adresse</p>
                  <p className="font-medium">{client.address}</p>
                  <p className="font-medium">
                    {client.zip_code || client.postal_code} {client.city}
                  </p>
                  {client.country && (
                    <p className="font-medium">{client.country}</p>
                  )}
                </div>
              )}

              {client.assigned_agent && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    Agent assigné
                  </p>
                  <p className="font-medium">
                    {client.assigned_agent.first_name &&
                    client.assigned_agent.last_name
                      ? `${client.assigned_agent.first_name} ${client.assigned_agent.last_name}`
                      : client.assigned_agent.email}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suivis">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Suivis</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau suivi
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun suivi pour ce client
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="propositions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Propositions</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle proposition
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune proposition pour ce client
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contrats">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contrats</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau contrat
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun contrat pour ce client
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Messages</CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau message
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun message pour ce client
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
