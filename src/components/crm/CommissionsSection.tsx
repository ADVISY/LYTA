import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, Plus } from "lucide-react";
import { useCommissions } from "@/hooks/useCommissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function CommissionsSection({ userId }: { userId: string }) {
  const { commissions, loading } = useCommissions();
  
  // Filter commissions for policies of this client
  const clientCommissions = commissions.filter(
    c => c.policy?.client?.id === userId
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              <CardTitle>Commissions</CardTitle>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle commission
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clientCommissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Aucune commission</p>
              <p className="text-sm">
                Aucune commission enregistrée pour ce client.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {clientCommissions.map((commission) => (
                <div
                  key={commission.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold">CHF {commission.amount}</p>
                      <Badge variant={
                        commission.status === 'paid' ? 'default' :
                        commission.status === 'due' ? 'secondary' : 'outline'
                      }>
                        {commission.status === 'paid' ? 'Payée' : 
                         commission.status === 'due' ? 'En attente' : commission.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {commission.policy?.policy_number && (
                        <p>Police: {commission.policy.policy_number}</p>
                      )}
                      {commission.period_month && commission.period_year && (
                        <p>Période: {commission.period_month}/{commission.period_year}</p>
                      )}
                      <p>Date: {format(new Date(commission.created_at), 'dd MMM yyyy', { locale: fr })}</p>
                    </div>
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
