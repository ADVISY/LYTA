import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, DollarSign } from "lucide-react";
import { usePolicies } from "@/hooks/usePolicies";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function MyContracts() {
  const { policies, loading } = usePolicies();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const activeContracts = policies.filter(p => p.status === 'active');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mes Contrats</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Consultez vos contrats d'assurance actifs
        </p>
      </div>

      <div className="grid gap-4">
        {activeContracts.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p>Aucun contrat actif pour le moment.</p>
            </CardContent>
          </Card>
        ) : (
          activeContracts.map((policy) => (
            <Card key={policy.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{policy.product?.name || 'Produit'}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {policy.product?.company?.name || 'Compagnie'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={policy.status === 'active' ? 'default' : 'secondary'}>
                    {policy.status === 'active' ? 'Actif' : policy.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date de début</p>
                      <p className="font-medium">
                        {format(new Date(policy.start_date), 'dd MMMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>
                  {policy.premium_monthly && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Prime mensuelle</p>
                        <p className="font-medium">CHF {Number(policy.premium_monthly).toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                </div>
                {policy.policy_number && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Numéro de police</p>
                    <p className="text-sm font-mono">{policy.policy_number}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
