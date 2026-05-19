import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserTenant } from "@/hooks/useUserTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Package, Search, ChevronDown, ChevronRight, Loader2, Users, Edit2, Check, X, DollarSign, Plus, Trash2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CompanyContactsPanel } from "@/components/crm/CompanyContactsPanel";
import { InsuranceCompanyLogo } from "@/components/crm/InsuranceCompanyLogo";
import { BranchChip, BranchSelector } from "@/components/crm/BranchSelector";
import { TenantBranchesPanel } from "@/components/crm/TenantBranchesPanel";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type CommissionOverride = {
  commission_type: string | null;
  commission_value: number | null;
  commission_description: string | null;
};

type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  commission_type: string | null;       // valeur système / défaut produit
  commission_value: number | null;
  commission_description: string | null;
  tenant_id: string | null;              // NULL = produit système (verrouillé sauf commission)
  tenant_branch_id: string | null;
  tenant_branch?: {
    id: string;
    code: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  override?: CommissionOverride | null;  // override commission du tenant courant
};

// Helpers : commission effective (override si présent sinon défaut produit)
const effectiveCommission = (p: Product): CommissionOverride => ({
  commission_type: p.override?.commission_type ?? p.commission_type,
  commission_value: p.override?.commission_value ?? p.commission_value,
  commission_description: p.override?.commission_description ?? p.commission_description,
});

type Company = {
  id: string;
  name: string;
  logo_url: string | null;
  website?: string | null;
  products: Product[];
};

const getCategoryLabels = (t: any): Record<string, { label: string; color: string }> => ({
  health: { label: t('settings.categoryHealth'), color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  auto: { label: t('settings.categoryAuto'), color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  home: { label: t('settings.categoryProperty'), color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  life: { label: t('settings.categoryLife'), color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  legal: { label: t('settings.categoryLegal'), color: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-400" },
  lamal: { label: "LAMal", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  lca: { label: "LCA", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
});

const formatCommissionDisplay = (type: string | null, value: number | null, description: string | null) => {
  if (!type || value === null || value === 0) return null;
  
  switch (type) {
    case 'fixed': return `${value} CHF`;
    case 'multiplier': return `Prime × ${value}`;
    case 'percentage': return `${value}%`;
    default: return description || null;
  }
};

const getCategoryOptions = (t: any) => [
  { value: 'health', label: t('settings.categoryHealth') },
  { value: 'lamal', label: 'LAMal' },
  { value: 'lca', label: 'LCA' },
  { value: 'life', label: t('settings.categoryLife') },
  { value: 'auto', label: t('settings.categoryAuto') },
  { value: 'home', label: t('settings.categoryProperty') },
  { value: 'legal', label: t('settings.categoryLegal') },
];

export default function CRMCompagnies() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useUserTenant();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openCompanies, setOpenCompanies] = useState<Set<string>>(new Set());
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ type: string; value: string; description: string }>({ type: 'multiplier', value: '', description: '' });
  const [saving, setSaving] = useState(false);
  
  // Company dialogs
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({ name: '', logo_url: '', website: '' });
  const [deleteCompanyDialog, setDeleteCompanyDialog] = useState<Company | null>(null);
  
  // Product dialogs
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productCompanyId, setProductCompanyId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<{
    name: string;
    category: string;
    tenant_branch_id: string | null;
    description: string;
    commission_type: string;
    commission_value: string;
    commission_description: string;
  }>({ name: '', category: 'health', tenant_branch_id: null, description: '', commission_type: 'multiplier', commission_value: '', commission_description: '' });
  const [deleteProductDialog, setDeleteProductDialog] = useState<Product | null>(null);
  
  const categoryLabels = getCategoryLabels(t);
  const CATEGORIES = getCategoryOptions(t);
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      
      const { data: companiesData, error: companiesError } = await supabase
        .from('insurance_companies')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (companiesError) throw companiesError;

      const { data: productsData, error: productsError } = await supabase
        .from('insurance_products')
        .select(`
          *,
          tenant_branch:tenant_branches (
            id,
            code,
            name,
            icon,
            color
          )
        `)
        .order('name');

      if (productsError) throw productsError;

      // Récupérer les overrides du tenant courant (1 row max par produit)
      // RLS limite déjà aux overrides de mon tenant, donc pas besoin de filtrer
      // explicitement par tenant_id côté front.
      const { data: overridesData } = await supabase
        .from('tenant_product_commission_overrides')
        .select('product_id, commission_type, commission_value, commission_description');
      const overridesByProduct: Record<string, CommissionOverride> = Object.fromEntries(
        (overridesData || []).map(o => [o.product_id as string, {
          commission_type: o.commission_type,
          commission_value: o.commission_value,
          commission_description: o.commission_description,
        }])
      );

      // Filter out "Dépôt contrat" products - they are only for email submissions
      const visibleProducts: Product[] = (productsData || [])
        .filter(p =>
          !p.name?.toLowerCase().includes('dépôt contrat') &&
          !p.name?.toLowerCase().includes('depot contrat')
        )
        .map(p => ({
          ...(p as Product),
          override: overridesByProduct[p.id] ?? null,
        }));

      const companiesWithProducts = (companiesData || []).map(company => ({
        ...company,
        products: visibleProducts.filter(p => p.company_id === company.id)
      }));

      setCompanies(companiesWithProducts);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCompany = (id: string) => {
    const newOpen = new Set(openCompanies);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }
    setOpenCompanies(newOpen);
  };

  // Commission inline edit — utilise la commission EFFECTIVE (override si présent)
  const startEditCommission = (product: Product) => {
    const eff = effectiveCommission(product);
    setEditingProduct(product.id);
    setEditForm({
      type: eff.commission_type || 'multiplier',
      value: eff.commission_value?.toString() || '',
      description: eff.commission_description || ''
    });
  };

  const cancelEditCommission = () => {
    setEditingProduct(null);
    setEditForm({ type: 'multiplier', value: '', description: '' });
  };

  const saveProductCommission = async (productId: string) => {
    try {
      setSaving(true);

      let description = editForm.description;
      if (!description) {
        switch (editForm.type) {
          case 'fixed':
            description = `${editForm.value} CHF par contrat`;
            break;
          case 'multiplier':
            description = `Prime mensuelle × ${editForm.value}`;
            break;
          case 'percentage':
            description = `${editForm.value}% de la prime`;
            break;
        }
      }

      // Trouver le produit pour savoir s'il est système ou tenant
      const allProducts = companies.flatMap(c => c.products);
      const product = allProducts.find(p => p.id === productId);
      const isSystem = product?.tenant_id === null;

      const commissionPayload = {
        commission_type: editForm.type,
        commission_value: parseFloat(editForm.value) || 0,
        commission_description: description,
      };

      if (isSystem) {
        // Produit système → on enregistre un OVERRIDE privé au tenant courant.
        // La RLS empêche déjà un tenant de modifier un produit système directement.
        if (!tenantId) throw new Error('Tenant non identifié');
        const { error } = await supabase
          .from('tenant_product_commission_overrides')
          .upsert({
            tenant_id: tenantId,
            product_id: productId,
            ...commissionPayload,
          }, { onConflict: 'tenant_id,product_id' });
        if (error) throw error;
        toast({ title: "Succès", description: "Commission personnalisée pour ton cabinet" });
      } else {
        // Produit tenant → édition directe sur insurance_products
        const { error } = await supabase
          .from('insurance_products')
          .update(commissionPayload)
          .eq('id', productId);
        if (error) throw error;
        toast({ title: "Succès", description: "Commission mise à jour" });
      }

      setEditingProduct(null);
      fetchCompanies();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Réinitialise la commission au défaut système (supprime l'override du tenant)
  const resetCommissionOverride = async (productId: string) => {
    try {
      setSaving(true);
      if (!tenantId) throw new Error('Tenant non identifié');
      const { error } = await supabase
        .from('tenant_product_commission_overrides')
        .delete()
        .eq('product_id', productId)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      toast({ title: "Réinitialisé", description: "Commission ramenée au défaut système" });
      setEditingProduct(null);
      fetchCompanies();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Company CRUD
  const openAddCompany = () => {
    setCompanyToEdit(null);
    setCompanyForm({ name: '', logo_url: '', website: '' });
    setCompanyDialogOpen(true);
  };

  const openEditCompany = (company: Company) => {
    setCompanyToEdit(company);
    setCompanyForm({ 
      name: company.name, 
      logo_url: company.logo_url || '', 
      website: company.website || '' 
    });
    setCompanyDialogOpen(true);
  };

  const saveCompany = async () => {
    try {
      setSaving(true);
      
      if (companyToEdit) {
        const { error } = await supabase
          .from('insurance_companies')
          .update({ 
            name: companyForm.name, 
            logo_url: companyForm.logo_url || null,
            website: companyForm.website || null
          })
          .eq('id', companyToEdit.id);
        if (error) throw error;
        toast({ title: "Succès", description: "Compagnie modifiée" });
      } else {
        // Tenant scoping : on crée la compagnie POUR le tenant courant
        // (sinon la RLS bloque pour les non-king et la compagnie est créée
        // en "système" partagé, ce qui pollue le master catalog).
        const { error } = await supabase
          .from('insurance_companies')
          .insert({
            name: companyForm.name,
            logo_url: companyForm.logo_url || null,
            website: companyForm.website || null,
            tenant_id: tenantId ?? null,
          });
        if (error) throw error;
        toast({ title: "Succès", description: "Compagnie créée pour ton cabinet" });
      }
      
      setCompanyDialogOpen(false);
      fetchCompanies();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteCompany = async () => {
    if (!deleteCompanyDialog) return;
    try {
      setSaving(true);
      
      // First delete all products of this company
      const { error: productsError } = await supabase
        .from('insurance_products')
        .delete()
        .eq('company_id', deleteCompanyDialog.id);
      if (productsError) throw productsError;
      
      const { error } = await supabase
        .from('insurance_companies')
        .delete()
        .eq('id', deleteCompanyDialog.id);
      if (error) throw error;
      
      toast({ title: "Succès", description: "Compagnie supprimée" });
      setDeleteCompanyDialog(null);
      fetchCompanies();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Product CRUD
  const openAddProduct = (companyId: string) => {
    setProductToEdit(null);
    setProductCompanyId(companyId);
    setProductForm({ name: '', category: 'health', tenant_branch_id: null, description: '', commission_type: 'multiplier', commission_value: '', commission_description: '' });
    setProductDialogOpen(true);
  };

  const openEditProduct = (product: Product, companyId: string) => {
    setProductToEdit(product);
    setProductCompanyId(companyId);
    setProductForm({
      name: product.name,
      category: product.category,
      tenant_branch_id: product.tenant_branch_id ?? null,
      description: product.description || '',
      commission_type: product.commission_type || 'multiplier',
      commission_value: product.commission_value?.toString() || '',
      commission_description: product.commission_description || ''
    });
    setProductDialogOpen(true);
  };

  const saveProduct = async () => {
    try {
      setSaving(true);
      
      let description = productForm.commission_description;
      if (!description && productForm.commission_value) {
        switch (productForm.commission_type) {
          case 'fixed':
            description = `${productForm.commission_value} CHF par contrat`;
            break;
          case 'multiplier':
            description = `Prime mensuelle × ${productForm.commission_value}`;
            break;
          case 'percentage':
            description = `${productForm.commission_value}% de la prime`;
            break;
        }
      }
      
      const productData: any = {
        name: productForm.name,
        category: productForm.category,
        tenant_branch_id: productForm.tenant_branch_id,
        description: productForm.description || null,
        commission_type: productForm.commission_type,
        commission_value: parseFloat(productForm.commission_value) || 0,
        commission_description: description || null
      };
      
      if (productToEdit) {
        // Use .select() to detect silent RLS blocks (UPDATE returning 0 rows
        // with no error — used to make "modification" appear successful while
        // nothing was actually persisted).
        const { data, error } = await supabase
          .from('insurance_products')
          .update(productData)
          .eq('id', productToEdit.id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("La modification n'a rien changé (probablement bloqué par les permissions RLS — vérifie ton rôle).");
        }
        toast({ title: "Succès", description: "Produit modifié" });
      } else {
        if (!tenantId) {
          throw new Error("Tenant introuvable — impossible de créer le produit.");
        }
        const { error } = await supabase
          .from('insurance_products')
          .insert({ ...productData, company_id: productCompanyId, tenant_id: tenantId });
        if (error) throw error;
        toast({ title: "Succès", description: "Produit créé" });
      }

      setProductDialogOpen(false);
      await fetchCompanies();
      // Invalidate the policies cache so contract cards on client pages
      // immediately reflect the new branch/category for this product.
      await queryClient.invalidateQueries({ queryKey: ['policies'] });
      await queryClient.invalidateQueries({ queryKey: ['insurance_products'] });
      // Custom event : signal au ContractForm (qui utilise un useState local
      // pour la liste produits) de re-fetch immédiatement. Sinon une session
      // ouverte sur le ContractForm verrait des données stale après un
      // changement de sous-branche d'un produit dans Partenaires.
      window.dispatchEvent(new CustomEvent('lyta:product-catalog-changed'));
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async () => {
    if (!deleteProductDialog) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('insurance_products')
        .delete()
        .eq('id', deleteProductDialog.id);
      if (error) throw error;
      
      toast({ title: "Succès", description: "Produit supprimé" });
      setDeleteProductDialog(null);
      fetchCompanies();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredCompanies = companies.filter(company => {
    const searchLower = search.toLowerCase();
    const companyMatch = company.name.toLowerCase().includes(searchLower);
    const productMatch = company.products.some(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.category.toLowerCase().includes(searchLower)
    );
    return companyMatch || productMatch;
  });

  const totalProducts = companies.reduce((sum, c) => sum + c.products.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('companies.title')}</h1>
            <p className="text-muted-foreground">{t('companies.subtitle')}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="companies" className="w-full">
        <TabsList>
          <TabsTrigger value="companies" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Compagnies &amp; Produits
          </TabsTrigger>
          <TabsTrigger value="branches" className="gap-1.5">
            <Package className="h-4 w-4" />
            Mes branches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branches" className="mt-6">
          <TenantBranchesPanel />
        </TabsContent>

        <TabsContent value="companies" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Button onClick={openAddCompany} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('companyForm.addCompany')}
            </Button>
          </div>

          {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('companies.companies')}</p>
            <p className="text-2xl font-bold text-primary">{companies.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('companies.products')}</p>
            <p className="text-2xl font-bold text-primary">{totalProducts}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('settings.categoryHealth')}</p>
            <p className="text-2xl font-bold text-primary">
              {companies.reduce((sum, c) => sum + c.products.filter(p => ['health', 'lamal', 'lca'].includes(p.category)).length, 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('settings.categoryAuto')}/{t('settings.categoryProperty')}</p>
            <p className="text-2xl font-bold text-primary">
              {companies.reduce((sum, c) => sum + c.products.filter(p => ['auto', 'home'].includes(p.category)).length, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('companies.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Companies List */}
      <div className="space-y-4">
        {filteredCompanies.map((company) => (
          <Collapsible
            key={company.id}
            open={openCompanies.has(company.id)}
            onOpenChange={() => toggleCompany(company.id)}
          >
            <Card className="border-0 shadow-lg bg-card/80 backdrop-blur overflow-hidden">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-4 flex-1">
                      <InsuranceCompanyLogo
                        name={company.name}
                        logoUrl={company.logo_url}
                        size="lg"
                      />
                      <div>
                        <CardTitle className="text-lg">{company.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {company.products.length} {t('companies.products').toLowerCase()}
                        </p>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex gap-2">
                      {Object.entries(
                        company.products.reduce((acc, p) => {
                          acc[p.category] = (acc[p.category] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([cat, count]) => (
                        <Badge 
                          key={cat} 
                          variant="secondary"
                          className={cn("text-xs", categoryLabels[cat]?.color)}
                        >
                          {categoryLabels[cat]?.label || cat} ({count})
                        </Badge>
                      ))}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditCompany(company)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          {t('companyForm.modifyCompany')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAddProduct(company.id)}>
                          <Plus className="h-4 w-4 mr-2" />
                          {t('companyForm.addProduct')}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeleteCompanyDialog(company)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('companyForm.deleteCompany')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {openCompanies.has(company.id) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </CardHeader>
              
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4">
                  <Tabs defaultValue="products" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="products" className="gap-1.5">
                        <Package className="h-4 w-4" />
                        {t('companies.products')} ({company.products.length})
                      </TabsTrigger>
                      <TabsTrigger value="contacts" className="gap-1.5">
                        <Users className="h-4 w-4" />
                        {t('companies.contacts')}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="products">
                      <div className="mb-4">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => openAddProduct(company.id)}
                          className="gap-1.5"
                        >
                          <Plus className="h-4 w-4" />
                          {t('companyForm.addProduct')}
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {company.products.map((product) => (
                          <div
                            key={product.id}
                            className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-background">
                                <Package className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-medium text-sm truncate">{product.name}</p>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => openEditProduct(product, company.id)}>
                                        <Edit2 className="h-4 w-4 mr-2" />
                                        {t('companyForm.editProduct')}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => startEditCommission(product)}>
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        {t('companyForm.editCommission')}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => setDeleteProductDialog(product)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        {t('common.delete')}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                <div className="mt-1">
                                  {product.tenant_branch ? (
                                    <BranchChip branch={product.tenant_branch} />
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className={cn("text-xs", categoryLabels[product.category]?.color)}
                                    >
                                      {categoryLabels[product.category]?.label || product.category}
                                    </Badge>
                                  )}
                                </div>
                                
                                {/* Commission Display/Edit */}
                                {editingProduct === product.id ? (
                                  <div className="mt-3 space-y-2 p-2 rounded-lg bg-background border">
                                    <Select
                                      value={editForm.type}
                                      onValueChange={(value) => setEditForm(prev => ({ ...prev, type: value }))}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="fixed">{t('companyForm.fixed')}</SelectItem>
                                        <SelectItem value="multiplier">{t('companyForm.multiplier')}</SelectItem>
                                        <SelectItem value="percentage">{t('companyForm.percentage')}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      type="number"
                                      placeholder={editForm.type === 'fixed' ? t('companyForm.fixedAmount') : editForm.type === 'multiplier' ? 'Ex: 16' : 'Ex: 4'}
                                      value={editForm.value}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, value: e.target.value }))}
                                      className="h-8 text-xs"
                                    />
                                    <Input
                                      placeholder={t('companyForm.formulaDesc')}
                                      value={editForm.description}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                      className="h-8 text-xs"
                                    />
                                    <div className="flex gap-1 flex-wrap">
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs flex-1"
                                        onClick={() => saveProductCommission(product.id)}
                                        disabled={saving || !editForm.value}
                                      >
                                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                                        {t('common.save')}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={cancelEditCommission}
                                        disabled={saving}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                      {product.tenant_id === null && product.override && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 text-xs text-muted-foreground"
                                          onClick={() => resetCommissionOverride(product.id)}
                                          disabled={saving}
                                          title="Supprimer ma personnalisation et revenir au défaut système"
                                        >
                                          Réinitialiser
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-2">
                                    {(() => {
                                      const eff = effectiveCommission(product);
                                      const display = formatCommissionDisplay(eff.commission_type, eff.commission_value, eff.commission_description);
                                      const isCustom = product.tenant_id === null && !!product.override;
                                      return display ? (
                                        <div className="flex items-center gap-1.5 text-xs">
                                          <DollarSign className="h-3 w-3 text-primary" />
                                          <span className="font-medium text-primary">{display}</span>
                                          {isCustom && (
                                            <Badge variant="secondary" className="ml-1 h-5 text-[10px] px-1.5">
                                              Personnalisé
                                            </Badge>
                                          )}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground italic">
                                          {t('companyForm.noCommissionDefined')}
                                        </p>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="contacts">
                      <CompanyContactsPanel 
                        companyId={company.id} 
                        companyName={company.name}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
        </TabsContent>
      </Tabs>

      {/* Company Dialog */}
      <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {companyToEdit ? t('companyForm.editCompany') : t('companyForm.addCompany')}
            </DialogTitle>
            <DialogDescription>
              {companyToEdit ? t('companyForm.editCompanyDesc') : t('companyForm.addCompanyDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('companyForm.companyName')} *</Label>
              <Input
                value={companyForm.name}
                onChange={(e) => setCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('companyForm.companyNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('companyForm.logoUrl')}</Label>
              <div className="flex items-center gap-3">
                {/* Preview */}
                <div className="h-14 w-14 rounded-lg border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                  {companyForm.logo_url ? (
                    <img
                      src={companyForm.logo_url}
                      alt="logo"
                      className="max-h-12 max-w-12 object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                {/* Upload + URL input */}
                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    id="company-logo-upload"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        toast({ title: "Fichier trop volumineux", description: "Maximum 2 Mo.", variant: "destructive" });
                        return;
                      }
                      try {
                        setSaving(true);
                        const ext = file.name.split('.').pop() || 'png';
                        const filePath = `companies/${crypto.randomUUID()}.${ext}`;
                        const { error: upErr } = await supabase.storage
                          .from('tenant-logos')
                          .upload(filePath, file, { cacheControl: '3600', upsert: true });
                        if (upErr) throw upErr;
                        const { data: { publicUrl } } = supabase.storage.from('tenant-logos').getPublicUrl(filePath);
                        setCompanyForm(prev => ({ ...prev, logo_url: publicUrl }));
                        toast({ title: "Logo uploadé", description: "N'oublie pas d'enregistrer." });
                      } catch (err: any) {
                        toast({ title: "Erreur d'upload", description: err.message, variant: "destructive" });
                      } finally {
                        setSaving(false);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('company-logo-upload')?.click()}
                    disabled={saving}
                    className="w-full"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
                    Uploader un logo (PNG/JPG/SVG, max 2 Mo)
                  </Button>
                  <Input
                    value={companyForm.logo_url}
                    onChange={(e) => setCompanyForm(prev => ({ ...prev, logo_url: e.target.value }))}
                    placeholder="…ou coller une URL d'image"
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('companyForm.website')}</Label>
              <Input
                value={companyForm.website}
                onChange={(e) => setCompanyForm(prev => ({ ...prev, website: e.target.value }))}
                placeholder={t('companyForm.websitePlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveCompany} disabled={saving || !companyForm.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {companyToEdit ? t('common.edit') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {productToEdit ? t('companyForm.editProduct') : t('companyForm.addProduct')}
            </DialogTitle>
            <DialogDescription>
              {productToEdit ? t('companyForm.editCompanyDesc') : t('companyForm.addCompanyDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('productForm.productName')} *</Label>
              <Input
                value={productForm.name}
                onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('productForm.productName')}
              />
            </div>
            <div className="space-y-2">
              <Label>Branche d'assurance *</Label>
              <BranchSelector
                value={productForm.tenant_branch_id}
                onChange={(branchId) => setProductForm(prev => ({ ...prev, tenant_branch_id: branchId }))}
                placeholder="Sélectionner une branche"
              />
              <p className="text-xs text-muted-foreground">
                La branche définit la catégorie du produit (LAMal, LCA, Vie, Auto…). Gérez vos branches dans l'onglet "Mes branches".
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('productForm.description')}</Label>
              <Textarea
                value={productForm.description}
                onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('productForm.description')}
                rows={2}
              />
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {t('companyForm.commissionConfig')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('companyForm.calculationType')}</Label>
                  <Select
                    value={productForm.commission_type}
                    onValueChange={(value) => setProductForm(prev => ({ ...prev, commission_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">{t('companyForm.fixed')}</SelectItem>
                      <SelectItem value="multiplier">{t('companyForm.multiplier')}</SelectItem>
                      <SelectItem value="percentage">{t('companyForm.percentage')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    {productForm.commission_type === 'fixed' ? t('companyForm.fixedAmount') : 
                     productForm.commission_type === 'multiplier' ? t('companyForm.multiplierValue') : t('companyForm.percentageValue')}
                  </Label>
                  <Input
                    type="number"
                    value={productForm.commission_value}
                    onChange={(e) => setProductForm(prev => ({ ...prev, commission_value: e.target.value }))}
                    placeholder={productForm.commission_type === 'fixed' ? '70' : productForm.commission_type === 'multiplier' ? '16' : '4'}
                  />
                </div>
              </div>
              <div className="space-y-2 mt-3">
                <Label>{t('companyForm.formulaDesc')}</Label>
                <Input
                  value={productForm.commission_description}
                  onChange={(e) => setProductForm(prev => ({ ...prev, commission_description: e.target.value }))}
                  placeholder={t('companyForm.formulaPlaceholder')}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveProduct} disabled={saving || !productForm.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {productToEdit ? t('common.edit') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Company Confirmation */}
      <AlertDialog open={!!deleteCompanyDialog} onOpenChange={() => setDeleteCompanyDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('companyForm.deleteCompany')} ?</AlertDialogTitle>
            <AlertDialogDescription>
              {t('companyForm.deleteCompanyConfirm')} <strong>{deleteCompanyDialog?.name}</strong> ?
              {' '}{t('companyForm.deleteCompanyWarning')} ({deleteCompanyDialog?.products.length} {t('companies.products').toLowerCase()})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteCompany} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Product Confirmation */}
      <AlertDialog open={!!deleteProductDialog} onOpenChange={() => setDeleteProductDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('companyForm.deleteProduct')} ?</AlertDialogTitle>
            <AlertDialogDescription>
              {t('companyForm.deleteProductConfirm')} <strong>{deleteProductDialog?.name}</strong> ?
              {' '}{t('companyForm.deleteProductWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
