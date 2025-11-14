import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FollowUpSection({ userId }: { userId: string }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle>Suivi</CardTitle>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau suivi
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Aucun suivi</p>
            <p className="text-sm">
              Aucune activité de suivi pour ce client.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
