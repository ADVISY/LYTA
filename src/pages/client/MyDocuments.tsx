import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { useDocuments } from "@/hooks/useDocuments";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function MyDocuments() {
  const { documents, loading } = useDocuments();

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
        <h1 className="text-2xl font-bold">Mes Documents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Accédez à tous vos documents d'assurance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun document disponible pour le moment.
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: fr })}
                    </p>
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
