import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderOpen, Receipt } from "lucide-react";
import { TenantLookupCRUD } from "@/components/crm/settings/TenantLookupCRUD";
import {
  useTenantBillableServices,
  useTenantDocumentTypes,
} from "@/hooks/useTenantLookups";

export function TenantCatalogsTab() {
  const documentTypes = useTenantDocumentTypes();
  const billableServices = useTenantBillableServices();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Catalogues du cabinet</h2>
        <p className="text-muted-foreground text-sm">
          Personnalise les listes utilisées dans LYTA : types de documents que tu reçois et services que tu factures.
        </p>
      </div>

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Types de documents
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2">
            <Receipt className="h-4 w-4" />
            Services facturables
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4">
          <TenantLookupCRUD
            title="Types de documents"
            description="Catégories utilisées lors de l'upload d'un document client (police d'assurance, attestation, etc.)."
            addButtonLabel="Ajouter un type"
            emptyCustomMessage="Aucun type personnalisé. Ajoute-en si la liste standard ne te suffit pas."
            controller={documentTypes}
          />
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <TenantLookupCRUD
            title="Services facturables"
            description="Liste des prestations que tu peux ajouter en ligne sur une facture (déclaration d'impôt, conseil financier, etc.)."
            withServiceFields
            addButtonLabel="Ajouter un service"
            emptyCustomMessage="Aucun service personnalisé. Ajoute-en pour gagner du temps lors de la création de factures."
            controller={billableServices}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
