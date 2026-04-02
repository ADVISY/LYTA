import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ChevronLeft,
  Upload,
  FileSpreadsheet,
  FolderArchive,
  AlertCircle,
  Building2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TenantDataImport } from "@/components/king/TenantDataImport";
import { TenantDocumentImport } from "@/components/king/TenantDocumentImport";

export default function KingTenantImport() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("data");

  // Fetch tenant info
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['king-tenant-import', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .eq('id', tenantId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Tenant non trouvé</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/king/tenants')}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/king/tenants/${tenantId}`)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Import de données</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {tenant.name}
            </p>
          </div>
        </div>
      </div>

      {/* Info card */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-600 dark:text-blue-400">Migration de données</p>
              <p className="text-muted-foreground">
                Utilisez cet outil pour migrer les données d'un ancien CRM vers Lyta. 
                Téléchargez les templates CSV, remplissez-les avec vos données, puis importez-les.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="data" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Données (CSV)
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FolderArchive className="h-4 w-4" />
            Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="mt-6">
          <TenantDataImport 
            tenantId={tenant.id} 
            tenantName={tenant.name}
            onComplete={() => navigate(`/king/tenants/${tenantId}`)}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <TenantDocumentImport 
            tenantId={tenant.id} 
            tenantName={tenant.name}
            onComplete={() => navigate(`/king/tenants/${tenantId}`)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
