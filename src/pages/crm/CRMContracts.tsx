import { usePolicies } from "@/hooks/usePolicies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  pending: "En attente",
  active: "Actif",
  expired: "Expiré",
  cancelled: "Annulé",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  active: "bg-green-500",
  expired: "bg-gray-500",
  cancelled: "bg-red-500",
};

export default function CRMContracts() {
  const { policies, loading } = usePolicies();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Contrats</h1>
          <p className="text-muted-foreground">Gérez vos contrats d'assurance</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau contrat
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des contrats ({policies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucun contrat pour le moment
            </div>
          ) : (
            <div className="space-y-2">
              {policies.map((policy) => {
                const clientName = policy.client?.company_name || 
                  `${policy.client?.first_name || ''} ${policy.client?.last_name || ''}`.trim() || 
                  'Client inconnu';
                return (
                <div
                  key={policy.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{policy.product?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {policy.product?.company?.name} - {clientName}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">
                        {policy.premium_monthly} CHF/mois
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Début: {new Date(policy.start_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`${statusColors[policy.status]} text-white`}
                    >
                      {statusLabels[policy.status] || policy.status}
                    </Badge>
                    <Button variant="outline" size="sm">
                      Voir
                    </Button>
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
