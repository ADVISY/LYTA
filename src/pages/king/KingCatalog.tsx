import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Building2, MapPin } from "lucide-react";
import ProductCatalogManager from "@/components/king/ProductCatalogManager";
import CompanyCatalogManager from "@/components/king/CompanyCatalogManager";
import SwissPostalCodesManager from "@/components/king/SwissPostalCodesManager";

export default function KingCatalog() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Référentiels</h1>
        <p className="text-muted-foreground">
          Gestion des catalogues de produits, compagnies et données de référence
        </p>
      </div>

      <Tabs defaultValue="products">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Produits
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" />
            Compagnies
          </TabsTrigger>
          <TabsTrigger value="postal" className="gap-2">
            <MapPin className="h-4 w-4" />
            NPA Suisses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-6">
          <ProductCatalogManager />
        </TabsContent>

        <TabsContent value="companies" className="mt-6">
          <CompanyCatalogManager />
        </TabsContent>

        <TabsContent value="postal" className="mt-6">
          <SwissPostalCodesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
