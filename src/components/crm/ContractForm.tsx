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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, FileText } from "lucide-react";
import DocumentUpload from "./DocumentUpload";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

type ContractEntry = {
  id: string;
  companyId: string;
  productId: string;
  category: string | null;
  policyNumber: string;
  startDate: string;
  status: string;
  notes: string;
  lamalAmount: string;
  lcaAmount: string;
  monthlyPremium: string;
  durationYears: string;
  premiumMonthly: string;
  deductible: string;
  isOpen: boolean;
  documents: Array<{ file_key: string; file_name: string; doc_kind: string; mime_type: string; size_bytes: number }>;
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

const createEmptyEntry = (): ContractEntry => ({
  id: crypto.randomUUID(),
  companyId: "",
  productId: "",
  category: null,
  policyNumber: "",
  startDate: new Date().toISOString().split('T')[0],
  status: "pending",
  notes: "",
  lamalAmount: "",
  lcaAmount: "",
  monthlyPremium: "",
  durationYears: "",
  premiumMonthly: "",
  deductible: "",
  isOpen: true,
  documents: [],
});

export default function ContractForm({ clientId, open, onOpenChange, onSuccess }: ContractFormProps) {
  const { createDocument } = useDocuments();
  const { createPolicy } = usePolicies();
  const { toast } = useToast();
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [entries, setEntries] = useState<ContractEntry[]>([createEmptyEntry()]);

  useEffect(() => {
    if (open) {
      fetchCompaniesAndProducts();
      setEntries([createEmptyEntry()]);
    }
  }, [open]);

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

  const getProductsForCompany = (companyId: string) => {
    return allProducts.filter(p => p.company_id === companyId);
  };

  const updateEntry = (id: string, updates: Partial<ContractEntry>) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id !== id) return entry;
      
      const updated = { ...entry, ...updates };
      
      // Reset product when company changes
      if (updates.companyId && updates.companyId !== entry.companyId) {
        updated.productId = "";
        updated.category = null;
      }
      
      // Update category when product changes
      if (updates.productId) {
        const product = allProducts.find(p => p.id === updates.productId);
        updated.category = product?.category || null;
      }
      
      return updated;
    }));
  };

  const addDocumentToEntry = (entryId: string, doc: UploadedDoc) => {
    setEntries(prev => prev.map(entry => 
      entry.id === entryId 
        ? { ...entry, documents: [...entry.documents, doc] }
        : entry
    ));
  };

  const removeDocumentFromEntry = (entryId: string, docIndex: number) => {
    setEntries(prev => prev.map(entry => 
      entry.id === entryId 
        ? { ...entry, documents: entry.documents.filter((_, i) => i !== docIndex) }
        : entry
    ));
  };

  const addEntry = () => {
    setEntries(prev => [...prev, createEmptyEntry()]);
  };

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  const toggleEntry = (id: string) => {
    setEntries(prev => prev.map(entry => 
      entry.id === id ? { ...entry, isOpen: !entry.isOpen } : entry
    ));
  };

  const getEntryTitle = (entry: ContractEntry, index: number) => {
    if (!entry.productId) return `Produit ${index + 1}`;
    const product = allProducts.find(p => p.id === entry.productId);
    const company = companies.find(c => c.id === entry.companyId);
    return `${product?.name || ''} - ${company?.name || ''}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validEntries = entries.filter(entry => entry.productId && entry.startDate);
    
    if (validEntries.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez ajouter au moins un produit avec une date de début",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      for (const entry of validEntries) {
        let calculatedPremium = 0;
        let endDate: string | null = null;
        let notesWithDetails = '';
        const deductibleValue = parseFloat(entry.deductible) || null;

        if (entry.category === 'health') {
          const lamal = parseFloat(entry.lamalAmount) || 0;
          const lca = parseFloat(entry.lcaAmount) || 0;
          calculatedPremium = lamal + lca;
          // Format structured notes for health
          const notesParts = [];
          notesParts.push(`LAMal: ${lamal.toFixed(2)} CHF`);
          notesParts.push(`LCA: ${lca.toFixed(2)} CHF`);
          if (deductibleValue) {
            notesParts.push(`Franchise: ${deductibleValue} CHF`);
          }
          if (entry.notes) {
            notesParts.push(entry.notes);
          }
          notesWithDetails = notesParts.join('\n');
        } else if (entry.category === 'life') {
          calculatedPremium = parseFloat(entry.monthlyPremium) || 0;
          const years = parseInt(entry.durationYears) || 0;
          const notesParts = [];
          notesParts.push(`Prime mensuelle: ${calculatedPremium.toFixed(2)} CHF`);
          if (years > 0) {
            const start = new Date(entry.startDate);
            start.setFullYear(start.getFullYear() + years);
            endDate = start.toISOString().split('T')[0];
            notesParts.push(`Durée: ${years} ans`);
          }
          if (entry.notes) {
            notesParts.push(entry.notes);
          }
          notesWithDetails = notesParts.join('\n');
        } else {
          calculatedPremium = parseFloat(entry.premiumMonthly) || 0;
          const notesParts = [];
          notesParts.push(`Prime mensuelle: ${calculatedPremium.toFixed(2)} CHF`);
          if (deductibleValue) {
            notesParts.push(`Franchise: ${deductibleValue} CHF`);
          }
          if (entry.notes) {
            notesParts.push(entry.notes);
          }
          notesWithDetails = notesParts.join('\n');
        }

        const policyData = {
          client_id: clientId,
          product_id: entry.productId,
          policy_number: entry.policyNumber || null,
          start_date: entry.startDate,
          end_date: endDate,
          premium_monthly: calculatedPremium,
          premium_yearly: calculatedPremium * 12,
          deductible: deductibleValue,
          status: entry.status,
          notes: notesWithDetails || null,
        };

        const policy = await createPolicy(policyData);

        // Save documents linked to this policy
        if (entry.documents.length > 0 && policy?.id) {
          for (const doc of entry.documents) {
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
        description: `${validEntries.length} contrat(s) ajouté(s) avec succès`
      });

      setEntries([createEmptyEntry()]);
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

  const renderEntryFields = (entry: ContractEntry) => {
    const products = getProductsForCompany(entry.companyId);
    
    return (
      <div className="space-y-4 pt-4">
        {/* Company & Product Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Compagnie d'assurance *</Label>
            <Select 
              value={entry.companyId} 
              onValueChange={(value) => updateEntry(entry.id, { companyId: value })}
            >
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
            <Label>Produit *</Label>
            <Select 
              value={entry.productId} 
              onValueChange={(value) => updateEntry(entry.id, { productId: value })}
              disabled={!entry.companyId}
            >
              <SelectTrigger>
                <SelectValue placeholder={entry.companyId ? "Sélectionner un produit" : "Choisir d'abord une compagnie"} />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
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
        {entry.category === 'health' && (
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 space-y-4">
            <h4 className="font-semibold text-emerald-800">Assurance maladie</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Prime LAMal mensuelle (CHF)</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  placeholder="350.00"
                  value={entry.lamalAmount}
                  onChange={(e) => updateEntry(entry.id, { lamalAmount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prime LCA mensuelle (CHF)</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  placeholder="150.00"
                  value={entry.lcaAmount}
                  onChange={(e) => updateEntry(entry.id, { lcaAmount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Franchise LAMal (CHF)</Label>
                <Select 
                  value={entry.deductible} 
                  onValueChange={(value) => updateEntry(entry.id, { deductible: value })}
                >
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
            </div>
            {(entry.lamalAmount || entry.lcaAmount) && (
              <p className="text-sm text-emerald-700">
                Total mensuel: <strong>{((parseFloat(entry.lamalAmount) || 0) + (parseFloat(entry.lcaAmount) || 0)).toFixed(2)} CHF</strong>
              </p>
            )}
          </div>
        )}

        {/* Life Insurance Fields */}
        {entry.category === 'life' && (
          <div className="p-4 rounded-lg bg-violet-50 border border-violet-200 space-y-4">
            <h4 className="font-semibold text-violet-800">Assurance vie / Prévoyance</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prime mensuelle (CHF)</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  placeholder="200.00"
                  value={entry.monthlyPremium}
                  onChange={(e) => updateEntry(entry.id, { monthlyPremium: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Durée du contrat (années)</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  placeholder="10"
                  value={entry.durationYears}
                  onChange={(e) => updateEntry(entry.id, { durationYears: e.target.value })}
                />
              </div>
            </div>
            {entry.monthlyPremium && entry.durationYears && (
              <p className="text-sm text-violet-700">
                Total sur {entry.durationYears} ans: <strong>{(parseFloat(entry.monthlyPremium) * 12 * parseInt(entry.durationYears)).toLocaleString('fr-CH')} CHF</strong>
              </p>
            )}
          </div>
        )}

        {/* Other Insurance Types */}
        {entry.category && !['health', 'life'].includes(entry.category) && (
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 space-y-4">
            <h4 className="font-semibold text-blue-800">{categoryLabels[entry.category] || 'Assurance'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prime mensuelle (CHF)</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  placeholder="50.00"
                  value={entry.premiumMonthly}
                  onChange={(e) => updateEntry(entry.id, { premiumMonthly: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Franchise (CHF)</Label>
                <Input
                  type="number"
                  step="100"
                  min="0"
                  placeholder="300"
                  value={entry.deductible}
                  onChange={(e) => updateEntry(entry.id, { deductible: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* General Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Numéro de police</Label>
            <Input
              placeholder="POL-2024-001"
              value={entry.policyNumber}
              onChange={(e) => updateEntry(entry.id, { policyNumber: e.target.value })}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label>Date de début *</Label>
            <Input
              type="date"
              value={entry.startDate}
              onChange={(e) => updateEntry(entry.id, { startDate: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Statut</Label>
            <Select 
              value={entry.status} 
              onValueChange={(value) => updateEntry(entry.id, { status: value })}
            >
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

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            placeholder="Informations complémentaires..."
            value={entry.notes}
            onChange={(e) => updateEntry(entry.id, { notes: e.target.value })}
            maxLength={500}
            rows={2}
          />
        </div>

        {/* Documents Section */}
        <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <Label className="font-semibold">Documents ({entry.documents.length})</Label>
          </div>
          <DocumentUpload
            documents={entry.documents}
            onUpload={(doc) => addDocumentToEntry(entry.id, doc)}
            onRemove={(index) => removeDocumentFromEntry(entry.id, index)}
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveaux contrats</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {entries.map((entry, index) => (
              <Collapsible 
                key={entry.id} 
                open={entry.isOpen}
                onOpenChange={() => toggleEntry(entry.id)}
              >
                <div className="border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        {entry.isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span className="font-medium">{getEntryTitle(entry, index)}</span>
                        {entry.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {categoryLabels[entry.category]}
                          </span>
                        )}
                      </div>
                      {entries.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEntry(entry.id);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      {renderEntryFields(entry)}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addEntry}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un autre produit
            </Button>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer {entries.filter(e => e.productId).length} contrat(s)
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
