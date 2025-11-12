import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

// TODO: This component will fetch and display policies once Supabase types are regenerated

export function ContractsSection({ userId }: { userId: string }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle>Polices d'assurance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium mb-2">Section en cours de développement</p>
            <p className="text-sm">
              Les polices d'assurance seront affichées ici une fois la base de données configurée.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
