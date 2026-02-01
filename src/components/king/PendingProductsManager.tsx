import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingProducts, PendingProduct } from "@/hooks/usePendingProducts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle,
  X,
  GitMerge,
  Search,
  Bot,
  FileText,
  Building2,
  Edit2,
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  'VIE': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'LCA': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'NON_VIE': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'HYPO': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

export default function PendingProductsManager() {
  const { 
    pendingProducts, 
    activeProducts, 
    loading, 
    validateProduct, 
    mergeProduct, 
    rejectProduct 
  } = usePendingProducts();
  
  const [search, setSearch] = useState('');
  
  // Validate dialog state
  const [validateDialogOpen, setValidateDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PendingProduct | null>(null);
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Merge dialog state
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [targetProductId, setTargetProductId] = useState('');
  const [mergeSearch, setMergeSearch] = useState('');

  // Filter products
  const filteredProducts = pendingProducts.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Filter active products for merge
  const filteredActiveProducts = activeProducts.filter(p => {
    if (!mergeSearch) return true;
    return p.name.toLowerCase().includes(mergeSearch.toLowerCase()) ||
           p.company?.name?.toLowerCase().includes(mergeSearch.toLowerCase());
  });

  const openValidateDialog = (product: PendingProduct) => {
    setSelectedProduct(product);
    setNewName(product.name);
    setValidateDialogOpen(true);
  };

  const openMergeDialog = (product: PendingProduct) => {
    setSelectedProduct(product);
    setTargetProductId('');
    setMergeSearch('');
    setMergeDialogOpen(true);
  };

  const handleValidate = async () => {
    if (!selectedProduct) return;
    
    setIsSubmitting(true);
    try {
      const finalName = newName.trim() !== selectedProduct.name ? newName.trim() : undefined;
      await validateProduct(selectedProduct.id, finalName);
      setValidateDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedProduct || !targetProductId) return;
    
    setIsSubmitting(true);
    try {
      await mergeProduct(selectedProduct.id, targetProductId);
      setMergeDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (productId: string) => {
    if (!confirm('Rejeter ce produit candidat ?')) return;
    await rejectProduct(productId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Produits IA à valider</h2>
            <p className="text-muted-foreground">
              {pendingProducts.length} produit(s) détecté(s) par l'IA en attente de validation
            </p>
          </div>
        </div>
      </div>

      {/* Alert if pending products */}
      {pendingProducts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Ces produits ont été créés automatiquement par l'IA. Veuillez les valider, 
              fusionner avec un produit existant, ou les rejeter.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom détecté</TableHead>
                  <TableHead>Compagnie</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(product => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{product.detected_name || product.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{product.company?.name || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={CATEGORY_COLORS[product.main_category] || 'bg-gray-100 text-gray-800'}>
                        {product.main_category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Bot className="h-3 w-3" />
                        IA
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(product.created_at), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openValidateDialog(product)}
                          className="gap-1"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Valider
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openMergeDialog(product)}
                          className="gap-1"
                        >
                          <GitMerge className="h-3 w-3" />
                          Fusionner
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleReject(product.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle className="h-12 w-12 text-green-500/50" />
                        <p className="text-muted-foreground">
                          Aucun produit en attente de validation
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Les produits détectés par l'IA qui ne correspondent pas au catalogue apparaîtront ici
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Validate Dialog */}
      <Dialog open={validateDialogOpen} onOpenChange={setValidateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Valider le produit
            </DialogTitle>
            <DialogDescription>
              Ce produit sera ajouté au catalogue officiel et pourra être utilisé pour les contrats.
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Nom détecté par l'IA :</p>
                <p className="font-medium">{selectedProduct.detected_name || selectedProduct.name}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newName">Nom officiel du produit</Label>
                <Input
                  id="newName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nom du produit"
                />
                <p className="text-xs text-muted-foreground">
                  Vous pouvez corriger le nom. Le nom détecté sera automatiquement ajouté comme alias.
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <Edit2 className="h-4 w-4 text-blue-600" />
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Après validation, vous pourrez modifier la catégorie et ajouter d'autres alias depuis le catalogue.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleValidate} disabled={isSubmitting || !newName.trim()}>
              {isSubmitting ? 'Validation...' : 'Valider le produit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-blue-600" />
              Fusionner avec un produit existant
            </DialogTitle>
            <DialogDescription>
              Le nom détecté sera ajouté comme alias du produit sélectionné pour améliorer la reconnaissance future.
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Nom détecté :</p>
                <p className="font-medium">{selectedProduct.detected_name || selectedProduct.name}</p>
              </div>

              <div className="space-y-2">
                <Label>Rechercher un produit existant</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={mergeSearch}
                    onChange={(e) => setMergeSearch(e.target.value)}
                    placeholder="Rechercher..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sélectionner le produit cible</Label>
                <Select value={targetProductId} onValueChange={setTargetProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un produit..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {filteredActiveProducts.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.company?.name && (
                            <span className="text-xs text-muted-foreground">
                              ({p.company.name})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleMerge} disabled={isSubmitting || !targetProductId}>
              {isSubmitting ? 'Fusion...' : 'Fusionner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
