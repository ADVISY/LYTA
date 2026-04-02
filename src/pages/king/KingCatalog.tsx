import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Building2, MapPin, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ProductCatalogManager from "@/components/king/ProductCatalogManager";
import CompanyCatalogManager from "@/components/king/CompanyCatalogManager";
import SwissPostalCodesManager from "@/components/king/SwissPostalCodesManager";
import PendingProductsManager from "@/components/king/PendingProductsManager";
import { usePendingProducts } from "@/hooks/usePendingProducts";

export default function KingCatalog() {
  const { pendingProducts } = usePendingProducts();
  const pendingCount = pendingProducts.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Référentiels</h1>
        <p className="text-muted-foreground">
          Gestion des catalogues de produits, compagnies et données de référence
        </p>
      </div>

      <Tabs defaultValue={pendingCount > 0 ? "pending" : "products"}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="pending" className="gap-2 relative">
            <Bot className="h-4 w-4" />
            À valider
            {pendingCount > 0 && (
              <Badge 
                variant="destructive" 
                className="ml-1 h-5 min-w-5 px-1.5 text-xs"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
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

        <TabsContent value="pending" className="mt-6">
          <PendingProductsManager />
        </TabsContent>

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
