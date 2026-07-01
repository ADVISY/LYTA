import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderOpen, Receipt, Shield } from "lucide-react";
import { TenantLookupCRUD } from "@/components/crm/settings/TenantLookupCRUD";
import { TenantBranchesPanel } from "@/components/crm/TenantBranchesPanel";
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
          Personnalise les listes utilisées dans LYTA : types d'assurances, types de documents reçus et services facturés.
        </p>
      </div>

      <Tabs defaultValue="branches">
        <TabsList>
          {/* Nouveau (juin 2026) : gestion des types d'assurances (branches).
              Utilise TenantBranchesPanel qui existait déjà dans CRMCompagnies. */}
          <TabsTrigger value="branches" className="gap-2">
            <Shield className="h-4 w-4" />
            Types d'assurances
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Types de documents
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2">
            <Receipt className="h-4 w-4" />
            Services facturables
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branches" className="mt-4">
          <div className="space-y-2 mb-4">
            <p className="text-sm text-muted-foreground">
              Les branches standard (Auto, Moto, LAMal, Vie, LPP, etc.) sont livrées par défaut.
              Ajoute ici les branches personnalisées propres à ton cabinet — elles apparaîtront
              dans le catalogue produits et sur les fiches contrats.
            </p>
          </div>
          <TenantBranchesPanel />
        </TabsContent>

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
