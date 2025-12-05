import { useState, useEffect, useMemo } from "react";
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
import { Loader2, FileText, X, Check, Heart, Car, Home, Shield, Scale } from "lucide-react";
import DocumentUpload from "./DocumentUpload";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
  premium: string; // Individual premium for this product
  deductible: string;
  durationYears: string; // For life insurance
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
  property: "Ménage/RC",
  other: "Autre",
};

// Helper to generate unique IDs safely
const generateId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

const categoryIcons: Record<string, React.ReactNode> = {
  health: <Heart className="h-4 w-4" />,
  auto: <Car className="h-4 w-4" />,
  home: <Home className="h-4 w-4" />,
  life: <Shield className="h-4 w-4" />,
  legal: <Scale className="h-4 w-4" />,
  property: <Home className="h-4 w-4" />,
  other: <Shield className="h-4 w-4" />,
};

const categoryColors: Record<string, string> = {
  health: "bg-emerald-50 text-emerald-800 border-emerald-200",
  auto: "bg-orange-50 text-orange-800 border-orange-200",
  home: "bg-blue-50 text-blue-800 border-blue-200",
  life: "bg-violet-50 text-violet-800 border-violet-200",
  legal: "bg-amber-50 text-amber-800 border-amber-200",
  property: "bg-blue-50 text-blue-800 border-blue-200",
  other: "bg-gray-50 text-gray-800 border-gray-200",
};

// Helper to detect if a health product is LAMal or LCA
const isLamalProduct = (productName: string | null | undefined): boolean => {
  if (!productName) return false;
  const name = productName.toLowerCase();
  return name.includes('lamal') || name.includes('base') || name.includes('obligatoire');
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
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  
  // Health insurance specific - Global LAMal fields
  const [lamalPremium, setLamalPremium] = useState("");
  const [lamalFranchise, setLamalFranchise] = useState("");
  
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
    setStatus("active");
    setNotes("");
    setDocuments([]);
    setSelectedProducts([]);
    setProductSearch("");
    setLamalPremium("");
    setLamalFranchise("");
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
    if (!product || !product.id) return;
    
    const isSelected = selectedProducts.some(sp => sp.productId === product.id);
    
    if (isSelected) {
      setSelectedProducts(prev => prev.filter(sp => sp.productId !== product.id));
    } else {
      const category = product.category || 'other';
      setSelectedProducts(prev => [...prev, {
        id: generateId(),
        productId: product.id,
        name: product.name || 'Produit sans nom',
        category: category,
        premium: "",
        deductible: "",
        durationYears: "",
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
    setLamalPremium("");
    setLamalFranchise("");
  };

  // Categorize selected products
  const categorizedSelection = useMemo(() => {
    const safeProducts = selectedProducts.filter(p => p && p.id && p.category);
    const health = safeProducts.filter(p => p.category === 'health');
    const life = safeProducts.filter(p => p.category === 'life');
    const other = safeProducts.filter(p => !['health', 'life'].includes(p.category || ''));
    
    const healthLamal = health.filter(p => p.name && isLamalProduct(p.name));
    const healthLca = health.filter(p => !p.name || !isLamalProduct(p.name));
    
    return { healthLamal, healthLca, life, other, health };
  }, [selectedProducts]);

  // Calculate totals
  const totals = useMemo(() => {
    const lamal = parseFloat(lamalPremium) || 0;
    const lcaTotal = categorizedSelection.healthLca.reduce((sum, p) => sum + (parseFloat(p.premium) || 0), 0);
    const healthTotal = lamal + lcaTotal;
    
    const lifeTotal = categorizedSelection.life.reduce((sum, p) => sum + (parseFloat(p.premium) || 0), 0);
    const otherTotal = categorizedSelection.other.reduce((sum, p) => sum + (parseFloat(p.premium) || 0), 0);
    
    return {
      lamal,
      lcaTotal,
      healthTotal,
      lifeTotal,
      otherTotal,
      grandTotal: healthTotal + lifeTotal + otherTotal
    };
  }, [lamalPremium, categorizedSelection, selectedProducts]);

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
      // Get the company name
      const selectedCompany = companies.find(c => c.id === selectedCompanyId);
      const companyName = selectedCompany?.name || null;

      for (const product of selectedProducts) {
        let calculatedPremium = 0;
        let endDate: string | null = null;
        let notesWithDetails = '';
        let deductibleValue: number | null = null;

        if (product.category === 'health') {
          if (isLamalProduct(product.name)) {
            // LAMal product - use global LAMal premium and franchise
            calculatedPremium = parseFloat(lamalPremium) || 0;
            deductibleValue = parseFloat(lamalFranchise) || null;
            const notesParts = [];
            notesParts.push(`LAMal: ${calculatedPremium.toFixed(2)} CHF`);
            if (deductibleValue) {
              notesParts.push(`Franchise: ${deductibleValue} CHF`);
            }
            if (notes) notesParts.push(notes);
            notesWithDetails = notesParts.join('\n');
          } else {
            // LCA product - use individual premium
            calculatedPremium = parseFloat(product.premium) || 0;
            const notesParts = [];
            notesParts.push(`LCA: ${calculatedPremium.toFixed(2)} CHF`);
            if (notes) notesParts.push(notes);
            notesWithDetails = notesParts.join('\n');
          }
        } else if (product.category === 'life') {
          calculatedPremium = parseFloat(product.premium) || 0;
          const years = parseInt(product.durationYears) || 0;
          const notesParts = [];
          notesParts.push(`Prime mensuelle: ${calculatedPremium.toFixed(2)} CHF`);
          if (years > 0) {
            const start = new Date(startDate);
            start.setFullYear(start.getFullYear() + years);
            endDate = start.toISOString().split('T')[0];
            notesParts.push(`Durée: ${years} ans`);
          }
          if (notes) notesParts.push(notes);
          notesWithDetails = notesParts.join('\n');
        } else {
          calculatedPremium = parseFloat(product.premium) || 0;
          deductibleValue = parseFloat(product.deductible) || null;
          const notesParts = [];
          notesParts.push(`Prime mensuelle: ${calculatedPremium.toFixed(2)} CHF`);
          if (deductibleValue) {
            notesParts.push(`Franchise: ${deductibleValue} CHF`);
          }
          if (notes) notesParts.push(notes);
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
          company_name: companyName,
          product_type: product.category,
        };

        const policy = await createPolicy(policyData);

        // Save documents linked to each policy
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nouveaux contrats
            {selectedProducts.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedProducts.length} produit{selectedProducts.length > 1 ? 's' : ''} sélectionné{selectedProducts.length > 1 ? 's' : ''})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden gap-4">
            {/* Common Fields Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Compagnie *</Label>
                <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
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
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Date début *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Statut</Label>
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

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Documents</Label>
                <DocumentUpload
                  documents={documents}
                  onUpload={(doc) => setDocuments(prev => [...prev, doc])}
                  onRemove={(index) => setDocuments(prev => prev.filter((_, i) => i !== index))}
                />
              </div>
            </div>

            {/* Main Content */}
            {selectedCompanyId && (
              <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left: Product Selection List */}
                <div className="space-y-3 overflow-hidden flex flex-col border rounded-lg p-3">
                  <div className="space-y-2">
                    <Label className="font-semibold">Produits disponibles</Label>
                    <Input
                      placeholder="Rechercher..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="space-y-4 pr-2">
                      {Object.entries(groupedProducts()).map(([category, products]) => (
                        <div key={category}>
                          <div className={`flex items-center gap-2 text-xs font-semibold px-2 py-1.5 rounded-md mb-2 ${categoryColors[category] || 'bg-gray-100'}`}>
                            {categoryIcons[category]}
                            {categoryLabels[category] || category} ({products.length})
                          </div>
                          <div className="space-y-1 pl-1">
                            {products.map((product) => {
                              if (!product || !product.id) return null;
                              const isSelected = selectedProducts.some(sp => sp.productId === product.id);
                              const isLamal = product.category === 'health' && product.name && isLamalProduct(product.name);
                              return (
                                <div
                                  key={product.id}
                                  onClick={() => toggleProductSelection(product)}
                                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all text-sm ${
                                    isSelected 
                                      ? 'bg-primary text-primary-foreground shadow-sm' 
                                      : 'hover:bg-muted/80'
                                  }`}
                                >
                                  <Checkbox 
                                    checked={isSelected} 
                                    className={isSelected ? 'border-primary-foreground' : ''} 
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleProductSelection(product)}
                                  />
                                  <span className="flex-1 truncate">{product.name || 'Produit'}</span>
                                  {isLamal && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-primary-foreground/20' : 'bg-emerald-100 text-emerald-700'}`}>
                                      LAMal
                                    </span>
                                  )}
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

                {/* Right: Configuration Panel */}
                <div className="lg:col-span-2 overflow-hidden flex flex-col border rounded-lg">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-6">
                      {selectedProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <FileText className="h-12 w-12 mb-4 opacity-30" />
                          <p className="text-sm">Sélectionnez des produits dans la liste</p>
                        </div>
                      ) : (
                        <>
                          {/* HEALTH INSURANCE SECTION */}
                          {categorizedSelection.health.length > 0 && (
                            <div className={`p-4 rounded-xl border-2 ${categoryColors.health}`}>
                              <div className="flex items-center gap-2 mb-4">
                                {categoryIcons.health}
                                <h3 className="font-bold">Assurance Maladie</h3>
                              </div>
                              
                              {/* LAMal Section */}
                              {categorizedSelection.healthLamal.length > 0 && (
                                <div className="mb-4 p-3 bg-white/60 rounded-lg">
                                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-xs">LAMal</span>
                                    Assurance de base obligatoire
                                  </h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label className="text-xs">Prime mensuelle (CHF) *</Label>
                                      <Input
                                        type="number"
                                        step="0.05"
                                        min="0"
                                        placeholder="350.00"
                                        value={lamalPremium}
                                        onChange={(e) => setLamalPremium(e.target.value)}
                                        className="h-9 bg-white"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Franchise annuelle (CHF)</Label>
                                      <Select value={lamalFranchise} onValueChange={setLamalFranchise}>
                                        <SelectTrigger className="h-9 bg-white">
                                          <SelectValue placeholder="Sélectionner" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="300">300 CHF</SelectItem>
                                          <SelectItem value="500">500 CHF</SelectItem>
                                          <SelectItem value="1000">1'000 CHF</SelectItem>
                                          <SelectItem value="1500">1'500 CHF</SelectItem>
                                          <SelectItem value="2000">2'000 CHF</SelectItem>
                                          <SelectItem value="2500">2'500 CHF</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    Produit: {categorizedSelection.healthLamal.map(p => p.name || 'Produit').join(', ')}
                                  </div>
                                </div>
                              )}
                              
                              {/* LCA Section */}
                              {categorizedSelection.healthLca.length > 0 && (
                                <div className="p-3 bg-white/60 rounded-lg">
                                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-teal-600 text-white rounded text-xs">LCA</span>
                                    Assurances complémentaires ({categorizedSelection.healthLca.length})
                                  </h4>
                                  <div className="space-y-3">
                                    {categorizedSelection.healthLca.map((product) => {
                                      if (!product || !product.id) return null;
                                      return (
                                        <div key={product.id} className="flex items-center gap-3 p-2 bg-white rounded border">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{product.name || 'Produit'}</p>
                                          </div>
                                          <div className="w-32">
                                            <Input
                                              type="number"
                                              step="0.05"
                                              min="0"
                                              placeholder="Prime/mois"
                                              value={product.premium || ""}
                                              onChange={(e) => updateSelectedProduct(product.id, { premium: e.target.value })}
                                              className="h-8 text-sm"
                                            />
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedProducts(prev => prev.filter(sp => sp.id !== product.id))}
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {totals.lcaTotal > 0 && (
                                    <p className="mt-2 text-sm font-medium text-right">
                                      Total LCA: {totals.lcaTotal.toFixed(2)} CHF/mois
                                    </p>
                                  )}
                                </div>
                              )}
                              
                              {/* Health Total */}
                              {totals.healthTotal > 0 && (
                                <div className="mt-4 pt-3 border-t border-emerald-300">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold">Total Santé mensuel</span>
                                    <span className="text-lg font-bold">{totals.healthTotal.toFixed(2)} CHF</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* LIFE INSURANCE SECTION */}
                          {categorizedSelection.life.length > 0 && (
                            <div className={`p-4 rounded-xl border-2 ${categoryColors.life}`}>
                              <div className="flex items-center gap-2 mb-4">
                                {categoryIcons.life}
                                <h3 className="font-bold">Vie / Prévoyance / 3e Pilier</h3>
                              </div>
                              <div className="space-y-3">
                                {categorizedSelection.life.map((product) => {
                                  if (!product || !product.id) return null;
                                  return (
                                    <div key={product.id} className="p-3 bg-white/60 rounded-lg">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="font-medium text-sm">{product.name || 'Produit'}</p>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setSelectedProducts(prev => prev.filter(sp => sp.id !== product.id))}
                                          className="h-6 w-6 p-0 text-destructive"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label className="text-xs">Prime mensuelle (CHF)</Label>
                                          <Input
                                            type="number"
                                            step="0.05"
                                            min="0"
                                            placeholder="200.00"
                                            value={product.premium || ""}
                                            onChange={(e) => updateSelectedProduct(product.id, { premium: e.target.value })}
                                            className="h-8 text-sm bg-white"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Durée (années)</Label>
                                          <Input
                                            type="number"
                                            min="1"
                                            max="50"
                                            placeholder="10"
                                            value={product.durationYears || ""}
                                            onChange={(e) => updateSelectedProduct(product.id, { durationYears: e.target.value })}
                                            className="h-8 text-sm bg-white"
                                          />
                                        </div>
                                      </div>
                                      {product.premium && product.durationYears && (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                          Total sur {product.durationYears} ans: {(parseFloat(product.premium) * 12 * parseInt(product.durationYears)).toLocaleString('fr-CH')} CHF
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {totals.lifeTotal > 0 && (
                                <div className="mt-4 pt-3 border-t border-violet-300">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold">Total Vie mensuel</span>
                                    <span className="text-lg font-bold">{totals.lifeTotal.toFixed(2)} CHF</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* OTHER INSURANCES SECTION */}
                          {categorizedSelection.other.length > 0 && (
                            <div className="p-4 rounded-xl border-2 bg-slate-50 border-slate-200">
                              <div className="flex items-center gap-2 mb-4">
                                <Shield className="h-4 w-4" />
                                <h3 className="font-bold">Autres assurances</h3>
                              </div>
                              <div className="space-y-3">
                                {categorizedSelection.other.map((product) => {
                                  if (!product || !product.id) return null;
                                  const category = product.category || 'other';
                                  return (
                                    <div key={product.id} className="p-3 bg-white rounded-lg border">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[category] || 'bg-gray-100 text-gray-800'}`}>
                                            {categoryLabels[category] || category}
                                          </span>
                                          <p className="font-medium text-sm">{product.name || 'Produit'}</p>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setSelectedProducts(prev => prev.filter(sp => sp.id !== product.id))}
                                          className="h-6 w-6 p-0 text-destructive"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label className="text-xs">Prime mensuelle (CHF)</Label>
                                          <Input
                                            type="number"
                                            step="0.05"
                                            min="0"
                                            placeholder="50.00"
                                            value={product.premium || ""}
                                            onChange={(e) => updateSelectedProduct(product.id, { premium: e.target.value })}
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Franchise (CHF)</Label>
                                          <Input
                                            type="number"
                                            step="100"
                                            min="0"
                                            placeholder="200"
                                            value={product.deductible || ""}
                                            onChange={(e) => updateSelectedProduct(product.id, { deductible: e.target.value })}
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {totals.otherTotal > 0 && (
                                <div className="mt-4 pt-3 border-t border-slate-300">
                                  <div className="flex justify-between items-center">
                                    <span className="font-semibold">Total Autres mensuel</span>
                                    <span className="text-lg font-bold">{totals.otherTotal.toFixed(2)} CHF</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* GRAND TOTAL */}
                          {totals.grandTotal > 0 && (
                            <div className="p-4 bg-primary/5 rounded-xl border-2 border-primary/20">
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="font-bold text-lg">Total mensuel global</span>
                                  <p className="text-xs text-muted-foreground">{selectedProducts.length} produit(s)</p>
                                </div>
                                <span className="text-2xl font-bold text-primary">{totals.grandTotal.toFixed(2)} CHF</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                ≈ {(totals.grandTotal * 12).toLocaleString('fr-CH')} CHF/an
                              </p>
                            </div>
                          )}

                          {/* Notes */}
                          <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                              placeholder="Informations complémentaires..."
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              maxLength={500}
                              rows={2}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {documents.length > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {documents.length} document(s)
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting || selectedProducts.length === 0}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Créer {selectedProducts.length} contrat(s)
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
