import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, DollarSign } from "lucide-react";
import { usePolicies } from "@/hooks/usePolicies";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AllContracts() {
  const { policies, loading } = usePolicies();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'pending': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Actif';
      case 'pending': return 'En attente';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tous les Contrats</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vue globale de tous les contrats d'assurance
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Liste complète des contrats
            </CardTitle>
            <Badge variant="secondary">{policies.length} contrats</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun contrat enregistré.
            </p>
          ) : (
            <div className="space-y-3">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{policy.product?.name || 'Produit'}</p>
                      <p className="text-sm text-muted-foreground">
                        {policy.product?.company?.name || 'Compagnie'}
                      </p>
                    </div>
                    <Badge variant={getStatusColor(policy.status)}>
                      {getStatusLabel(policy.status)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Client</p>
                      <p className="text-sm font-medium">
                        {policy.client?.company_name || 
                         `${policy.client?.profile?.first_name || ''} ${policy.client?.profile?.last_name || ''}`.trim() ||
                         'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Début</p>
                      <p className="text-sm font-medium">
                        {format(new Date(policy.start_date), 'dd/MM/yyyy', { locale: fr })}
                      </p>
                    </div>
                    {policy.premium_monthly && (
                      <div>
                        <p className="text-xs text-muted-foreground">Prime mensuelle</p>
                        <p className="text-sm font-medium flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {Number(policy.premium_monthly).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
