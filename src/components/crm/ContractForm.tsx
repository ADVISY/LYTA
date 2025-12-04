import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePolicies } from "@/hooks/usePolicies";
import { useDocuments } from "@/hooks/useDocuments";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, X, Check } from "lucide-react";
import DocumentUpload from "./DocumentUpload";
import { ScrollArea } from "@/components/ui/scroll-area";

type Company = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  category: string;
  company_id: string;
};

type SelectedProduct = {
  id: string;
  productId: string;
  name: string;
  category: string;
  // Category-specific fields
  lamalAmount: string;
  lcaAmount: string;
  monthlyPremium: string;
  durationYears: string;
  premiumMonthly: string;
  deductible: string;
};

type UploadedDoc = { file_key: string; file_name: string; doc_kind: string; mime_type: string; size_bytes: number };

interface ContractFormProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const categoryLabels: Record<string, string> = {
  health: "Santé",
  auto: "Auto",
  home: "Ménage/RC",
  life: "Vie/Prévoyance",
  legal: "Protection juridique",
};

const categoryColors: Record<string, string> = {
  health: "bg-emerald-100 text-emerald-800 border-emerald-300",
  auto: "bg-orange-100 text-orange-800 border-orange-300",
  home: "bg-blue-100 text-blue-800 border-blue-300",
  life: "bg-violet-100 text-violet-800 border-violet-300",
  legal: "bg-amber-100 text-amber-800 border-amber-300",
};

export default function ContractForm({ clientId, open, onOpenChange, onSuccess }: ContractFormProps) {
  const { createDocument } = useDocuments();
  const { createPolicy } = usePolicies();
  const { toast } = useToast();
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Common fields
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  
  // Selected products
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    if (open) {
      fetchCompaniesAndProducts();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setSelectedCompanyId("");
    setStartDate(new Date().toISOString().split('T')[0]);
    setStatus("pending");
    setNotes("");
    setDocuments([]);
    setSelectedProducts([]);
    setProductSearch("");
  };

  const fetchCompaniesAndProducts = async () => {
    setLoading(true);
    const [companiesRes, productsRes] = await Promise.all([
      supabase.from('insurance_companies').select('id, name').order('name'),
      supabase.from('insurance_products').select('id, name, category, company_id').order('category, name'),
    ]);
    
    if (companiesRes.data) setCompanies(companiesRes.data);
    if (productsRes.data) setAllProducts(productsRes.data);
    setLoading(false);
  };

  const getProductsForCompany = () => {
    if (!selectedCompanyId) return [];
    let products = allProducts.filter(p => p.company_id === selectedCompanyId);
    if (productSearch) {
      const search = productSearch.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(search) ||
        categoryLabels[p.category]?.toLowerCase().includes(search)
      );
    }
    return products;
  };

  const toggleProductSelection = (product: Product) => {
    const isSelected = selectedProducts.some(sp => sp.productId === product.id);
    
    if (isSelected) {
      setSelectedProducts(prev => prev.filter(sp => sp.productId !== product.id));
    } else {
      setSelectedProducts(prev => [...prev, {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        category: product.category,
        lamalAmount: "",
        lcaAmount: "",
        monthlyPremium: "",
        durationYears: "",
        premiumMonthly: "",
        deductible: "",
      }]);
    }
  };

  const updateSelectedProduct = (id: string, updates: Partial<SelectedProduct>) => {
    setSelectedProducts(prev => prev.map(sp => 
      sp.id === id ? { ...sp, ...updates } : sp
    ));
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedProducts([]);
    setProductSearch("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedProducts.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner au moins un produit",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      for (const product of selectedProducts) {
        let calculatedPremium = 0;
        let endDate: string | null = null;
        let notesWithDetails = '';
        const deductibleValue = parseFloat(product.deductible) || null;

        if (product.category === 'health') {
          const lamal = parseFloat(product.lamalAmount) || 0;
          const lca = parseFloat(product.lcaAmount) || 0;
          calculatedPremium = lamal + lca;
          const notesParts = [];
          notesParts.push(`LAMal: ${lamal.toFixed(2)} CHF`);
          notesParts.push(`LCA: ${lca.toFixed(2)} CHF`);
          if (deductibleValue) {
            notesParts.push(`Franchise: ${deductibleValue} CHF`);
          }
          if (notes) {
            notesParts.push(notes);
          }
          notesWithDetails = notesParts.join('\n');
        } else if (product.category === 'life') {
          calculatedPremium = parseFloat(product.monthlyPremium) || 0;
          const years = parseInt(product.durationYears) || 0;
          const notesParts = [];
          notesParts.push(`Prime mensuelle: ${calculatedPremium.toFixed(2)} CHF`);
          if (years > 0) {
            const start = new Date(startDate);
            start.setFullYear(start.getFullYear() + years);
            endDate = start.toISOString().split('T')[0];
            notesParts.push(`Durée: ${years} ans`);
          }
          if (notes) {
            notesParts.push(notes);
          }
          notesWithDetails = notesParts.join('\n');
        } else {
          calculatedPremium = parseFloat(product.premiumMonthly) || 0;
          const notesParts = [];
          notesParts.push(`Prime mensuelle: ${calculatedPremium.toFixed(2)} CHF`);
          if (deductibleValue) {
            notesParts.push(`Franchise: ${deductibleValue} CHF`);
          }
          if (notes) {
            notesParts.push(notes);
          }
          notesWithDetails = notesParts.join('\n');
        }

        const policyData = {
          client_id: clientId,
          product_id: product.productId,
          policy_number: null,
          start_date: startDate,
          end_date: endDate,
          premium_monthly: calculatedPremium,
          premium_yearly: calculatedPremium * 12,
          deductible: deductibleValue,
          status: status,
          notes: notesWithDetails || null,
        };

        const policy = await createPolicy(policyData);

        // Save documents linked to the first policy (shared documents)
        if (documents.length > 0 && policy?.id) {
          for (const doc of documents) {
            await createDocument({
              owner_id: policy.id,
              owner_type: 'policy',
              file_key: doc.file_key,
              file_name: doc.file_name,
              doc_kind: doc.doc_kind,
              mime_type: doc.mime_type,
              size_bytes: doc.size_bytes,
            });
          }
        }
      }
      
      toast({
        title: "Contrats créés",
        description: `${selectedProducts.length} contrat(s) ajouté(s) avec succès`
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer les contrats",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const groupedProducts = () => {
    const products = getProductsForCompany();
    const grouped: Record<string, Product[]> = {};
    products.forEach(p => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });
    return grouped;
  };

  const renderProductSpecificFields = (product: SelectedProduct) => {
    if (product.category === 'health') {
      return (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">LAMal (CHF/mois)</Label>
            <Input
              type="number"
              step="0.05"
              min="0"
              placeholder="350"
              value={product.lamalAmount}
              onChange={(e) => updateSelectedProduct(product.id, { lamalAmount: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">LCA (CHF/mois)</Label>
            <Input
              type="number"
              step="0.05"
              min="0"
              placeholder="150"
              value={product.lcaAmount}
              onChange={(e) => updateSelectedProduct(product.id, { lcaAmount: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Franchise</Label>
            <Select 
              value={product.deductible} 
              onValueChange={(value) => updateSelectedProduct(product.id, { deductible: value })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="300">300</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1'000</SelectItem>
                <SelectItem value="1500">1'500</SelectItem>
                <SelectItem value="2000">2'000</SelectItem>
                <SelectItem value="2500">2'500</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    if (product.category === 'life') {
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Prime (CHF/mois)</Label>
            <Input
              type="number"
              step="0.05"
              min="0"
              placeholder="200"
              value={product.monthlyPremium}
              onChange={(e) => updateSelectedProduct(product.id, { monthlyPremium: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Durée (années)</Label>
            <Input
              type="number"
              min="1"
              max="50"
              placeholder="10"
              value={product.durationYears}
              onChange={(e) => updateSelectedProduct(product.id, { durationYears: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      );
    }

    // Other categories (auto, home, legal)
    return (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Prime (CHF/mois)</Label>
          <Input
            type="number"
            step="0.05"
            min="0"
            placeholder="50"
            value={product.premiumMonthly}
            onChange={(e) => updateSelectedProduct(product.id, { premiumMonthly: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Franchise (CHF)</Label>
          <Input
            type="number"
            step="100"
            min="0"
            placeholder="300"
            value={product.deductible}
            onChange={(e) => updateSelectedProduct(product.id, { deductible: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Nouveaux contrats</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            {/* Step 1: Company Selection */}
            <div className="space-y-4 pb-4 border-b">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Compagnie d'assurance *</Label>
                  <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une compagnie" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date de début *</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="expired">Expiré</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Step 2: Product Selection */}
            {selectedCompanyId && (
              <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                {/* Left: Product List */}
                <div className="space-y-3 overflow-hidden flex flex-col">
                  <div className="space-y-2">
                    <Label>Sélectionner les produits</Label>
                    <Input
                      placeholder="Rechercher un produit..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="flex-1 border rounded-lg">
                    <div className="p-2 space-y-3">
                      {Object.entries(groupedProducts()).map(([category, products]) => (
                        <div key={category}>
                          <div className={`text-xs font-semibold px-2 py-1 rounded mb-1 ${categoryColors[category] || 'bg-gray-100'}`}>
                            {categoryLabels[category] || category} ({products.length})
                          </div>
                          <div className="space-y-1">
                            {products.map((product) => {
                              const isSelected = selectedProducts.some(sp => sp.productId === product.id);
                              return (
                                <div
                                  key={product.id}
                                  onClick={() => toggleProductSelection(product)}
                                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                    isSelected 
                                      ? 'bg-primary/10 border border-primary' 
                                      : 'hover:bg-muted border border-transparent'
                                  }`}
                                >
                                  <Checkbox checked={isSelected} />
                                  <span className="text-sm flex-1 truncate">{product.name}</span>
                                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {Object.keys(groupedProducts()).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Aucun produit trouvé
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Right: Selected Products with specific fields */}
                <div className="space-y-3 overflow-hidden flex flex-col">
                  <Label>Produits sélectionnés ({selectedProducts.length})</Label>
                  <ScrollArea className="flex-1 border rounded-lg">
                    <div className="p-2 space-y-3">
                      {selectedProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Sélectionnez des produits dans la liste
                        </p>
                      ) : (
                        selectedProducts.map((product) => (
                          <div 
                            key={product.id} 
                            className={`p-3 rounded-lg border space-y-3 ${categoryColors[product.category] || 'bg-muted/30'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{product.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedProducts(prev => prev.filter(sp => sp.id !== product.id))}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            {renderProductSpecificFields(product)}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            {/* Common fields: Notes & Documents */}
            {selectedProducts.length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Notes (communes à tous les contrats)</Label>
                    <Textarea
                      placeholder="Informations complémentaires..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={500}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <Label>Documents ({documents.length})</Label>
                    </div>
                    <DocumentUpload
                      documents={documents}
                      onUpload={(doc) => setDocuments(prev => [...prev, doc])}
                      onRemove={(index) => setDocuments(prev => prev.filter((_, i) => i !== index))}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting || selectedProducts.length === 0}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer {selectedProducts.length} contrat(s)
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
