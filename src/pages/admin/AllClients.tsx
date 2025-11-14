import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useClients } from "@/hooks/useClients";

export default function AllClients() {
  const { clients, loading } = useClients();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tous les Clients</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vue globale de tous les clients du système
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5" />
              Liste complète des clients
            </CardTitle>
            <Badge variant="secondary">{clients.length} clients</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun client enregistré.
            </p>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">
                      {client.company_name || `${client.profile?.first_name || ''} ${client.profile?.last_name || ''}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {client.profile?.email || client.phone || 'Pas de contact'}
                    </p>
                  </div>
                  <Badge variant={client.is_company ? 'default' : 'secondary'}>
                    {client.is_company ? 'Entreprise' : 'Particulier'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
