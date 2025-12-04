import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePolicies } from "@/hooks/usePolicies";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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

export default function ContractForm({ clientId, open, onOpenChange, onSuccess }: ContractFormProps) {
  const { createPolicy } = usePolicies();
  const { toast } = useToast();
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [policyNumber, setPolicyNumber] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  
  // Health-specific fields
  const [lamalAmount, setLamalAmount] = useState("");
  const [lcaAmount, setLcaAmount] = useState("");
  
  // Life-specific fields
  const [monthlyPremium, setMonthlyPremium] = useState("");
  const [durationYears, setDurationYears] = useState("");
  
  // General fields
  const [premiumMonthly, setPremiumMonthly] = useState("");
  const [deductible, setDeductible] = useState("");

  useEffect(() => {
    if (open) {
      fetchCompanies();
    }
  }, [open]);

  useEffect(() => {
    if (selectedCompany) {
      fetchProducts(selectedCompany);
      setSelectedProduct("");
      setSelectedCategory(null);
    }
  }, [selectedCompany]);

  useEffect(() => {
    // Get category from selected product
    if (selectedProduct) {
      const product = products.find(p => p.id === selectedProduct);
      setSelectedCategory(product?.category || null);
    }
  }, [selectedProduct, products]);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('insurance_companies')
      .select('id, name')
      .order('name');
    
    if (!error && data) {
      setCompanies(data);
    }
    setLoading(false);
  };

  const fetchProducts = async (companyId: string) => {
    const { data, error } = await supabase
      .from('insurance_products')
      .select('id, name, category, company_id')
      .eq('company_id', companyId)
      .order('category, name');
    
    if (!error && data) {
      setProducts(data);
    }
  };

  const resetForm = () => {
    setSelectedCompany("");
    setSelectedProduct("");
    setSelectedCategory(null);
    setPolicyNumber("");
    setStartDate(new Date().toISOString().split('T')[0]);
    setStatus("pending");
    setNotes("");
    setLamalAmount("");
    setLcaAmount("");
    setMonthlyPremium("");
    setDurationYears("");
    setPremiumMonthly("");
    setDeductible("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct || !startDate) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un produit et une date de début",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      // Calculate premium based on category
      let calculatedPremium = 0;
      let endDate: string | null = null;
      let notesWithDetails = notes;

      if (selectedCategory === 'health') {
        const lamal = parseFloat(lamalAmount) || 0;
        const lca = parseFloat(lcaAmount) || 0;
        calculatedPremium = lamal + lca;
        notesWithDetails = `LAMal: ${lamal} CHF, LCA: ${lca} CHF${notes ? `\n${notes}` : ''}`;
      } else if (selectedCategory === 'life') {
        calculatedPremium = parseFloat(monthlyPremium) || 0;
        const years = parseInt(durationYears) || 0;
        if (years > 0) {
          const start = new Date(startDate);
          start.setFullYear(start.getFullYear() + years);
          endDate = start.toISOString().split('T')[0];
          notesWithDetails = `Durée: ${years} ans${notes ? `\n${notes}` : ''}`;
        }
      } else {
        calculatedPremium = parseFloat(premiumMonthly) || 0;
      }

      const policyData = {
        client_id: clientId,
        product_id: selectedProduct,
        policy_number: policyNumber || null,
        start_date: startDate,
        end_date: endDate,
        premium_monthly: calculatedPremium,
        premium_yearly: calculatedPremium * 12,
        deductible: parseFloat(deductible) || null,
        status,
        notes: notesWithDetails || null,
      };

      await createPolicy(policyData);
      
      toast({
        title: "Contrat créé",
        description: "Le contrat a été ajouté avec succès"
      });

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le contrat",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau contrat</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company & Product Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Compagnie d'assurance *</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
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
              <Label htmlFor="product">Produit *</Label>
              <Select 
                value={selectedProduct} 
                onValueChange={setSelectedProduct}
                disabled={!selectedCompany}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedCompany ? "Sélectionner un produit" : "Choisir d'abord une compagnie"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          [{categoryLabels[product.category] || product.category}]
                        </span>
                        {product.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Health Insurance Fields */}
          {selectedCategory === 'health' && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 space-y-4">
              <h4 className="font-semibold text-emerald-800">Assurance maladie</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lamal">Prime LAMal mensuelle (CHF)</Label>
                  <Input
                    id="lamal"
                    type="number"
                    step="0.05"
                    min="0"
                    placeholder="350.00"
                    value={lamalAmount}
                    onChange={(e) => setLamalAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lca">Prime LCA mensuelle (CHF)</Label>
                  <Input
                    id="lca"
                    type="number"
                    step="0.05"
                    min="0"
                    placeholder="150.00"
                    value={lcaAmount}
                    onChange={(e) => setLcaAmount(e.target.value)}
                  />
                </div>
              </div>
              {(lamalAmount || lcaAmount) && (
                <p className="text-sm text-emerald-700">
                  Total mensuel: <strong>{((parseFloat(lamalAmount) || 0) + (parseFloat(lcaAmount) || 0)).toFixed(2)} CHF</strong>
                </p>
              )}
            </div>
          )}

          {/* Life Insurance Fields */}
          {selectedCategory === 'life' && (
            <div className="p-4 rounded-lg bg-violet-50 border border-violet-200 space-y-4">
              <h4 className="font-semibold text-violet-800">Assurance vie / Prévoyance</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlyPremium">Prime mensuelle (CHF)</Label>
                  <Input
                    id="monthlyPremium"
                    type="number"
                    step="0.05"
                    min="0"
                    placeholder="200.00"
                    value={monthlyPremium}
                    onChange={(e) => setMonthlyPremium(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Durée du contrat (années)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="50"
                    placeholder="10"
                    value={durationYears}
                    onChange={(e) => setDurationYears(e.target.value)}
                  />
                </div>
              </div>
              {monthlyPremium && durationYears && (
                <p className="text-sm text-violet-700">
                  Total sur {durationYears} ans: <strong>{(parseFloat(monthlyPremium) * 12 * parseInt(durationYears)).toLocaleString('fr-CH')} CHF</strong>
                </p>
              )}
            </div>
          )}

          {/* Other Insurance Types */}
          {selectedCategory && !['health', 'life'].includes(selectedCategory) && (
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 space-y-4">
              <h4 className="font-semibold text-blue-800">{categoryLabels[selectedCategory] || 'Assurance'}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="premium">Prime mensuelle (CHF)</Label>
                  <Input
                    id="premium"
                    type="number"
                    step="0.05"
                    min="0"
                    placeholder="50.00"
                    value={premiumMonthly}
                    onChange={(e) => setPremiumMonthly(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deductible">Franchise (CHF)</Label>
                  <Input
                    id="deductible"
                    type="number"
                    step="100"
                    min="0"
                    placeholder="300"
                    value={deductible}
                    onChange={(e) => setDeductible(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* General Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="policyNumber">Numéro de police</Label>
              <Input
                id="policyNumber"
                placeholder="POL-2024-001"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Date de début *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
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

            {selectedCategory === 'health' && (
              <div className="space-y-2">
                <Label htmlFor="deductibleHealth">Franchise LAMal (CHF)</Label>
                <Select value={deductible} onValueChange={setDeductible}>
                  <SelectTrigger>
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
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Informations complémentaires..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting || !selectedProduct}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer le contrat
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
