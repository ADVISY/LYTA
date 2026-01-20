import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  commission_type: string | null;
  commission_value: number | null;
  commission_description: string | null;
};

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

const CATEGORIES = [
  { value: 'health', label: 'Santé' },
  { value: 'lamal', label: 'LAMal' },
  { value: 'lca', label: 'LCA (Complémentaire)' },
  { value: 'life', label: 'Vie / 3e pilier' },
  { value: 'auto', label: 'Auto' },
  { value: 'home', label: 'Habitation' },
  { value: 'legal', label: 'Protection juridique' },
];

export default function CRMCompagnies() {
  const { t } = useTranslation();
  const { toast } = useToast();
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
  const [productForm, setProductForm] = useState({ name: '', category: 'health', description: '', commission_type: 'multiplier', commission_value: '', commission_description: '' });
  const [deleteProductDialog, setDeleteProductDialog] = useState<Product | null>(null);
  
  const categoryLabels = getCategoryLabels(t);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      
      const { data: companiesData, error: companiesError } = await supabase
        .from('insurance_companies')
        .select('*')
        .order('name');
      
      if (companiesError) throw companiesError;

      const { data: productsData, error: productsError } = await supabase
        .from('insurance_products')
        .select('*')
        .order('category, name');
      
      if (productsError) throw productsError;

      const companiesWithProducts = (companiesData || []).map(company => ({
        ...company,
        products: (productsData || []).filter(p => p.company_id === company.id)
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

  // Commission inline edit
  const startEditCommission = (product: Product) => {
    setEditingProduct(product.id);
    setEditForm({
      type: product.commission_type || 'multiplier',
      value: product.commission_value?.toString() || '',
      description: product.commission_description || ''
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

      const { error } = await supabase
        .from('insurance_products')
        .update({
          commission_type: editForm.type,
          commission_value: parseFloat(editForm.value) || 0,
          commission_description: description
        })
        .eq('id', productId);

      if (error) throw error;

      toast({ title: "Succès", description: "Commission mise à jour" });
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
        const { error } = await supabase
          .from('insurance_companies')
          .insert({ 
            name: companyForm.name, 
            logo_url: companyForm.logo_url || null,
            website: companyForm.website || null
          });
        if (error) throw error;
        toast({ title: "Succès", description: "Compagnie créée" });
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
    setProductForm({ name: '', category: 'health', description: '', commission_type: 'multiplier', commission_value: '', commission_description: '' });
    setProductDialogOpen(true);
  };

  const openEditProduct = (product: Product, companyId: string) => {
    setProductToEdit(product);
    setProductCompanyId(companyId);
    setProductForm({
      name: product.name,
      category: product.category,
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
      
      const productData = {
        name: productForm.name,
        category: productForm.category,
        description: productForm.description || null,
        commission_type: productForm.commission_type,
        commission_value: parseFloat(productForm.commission_value) || 0,
        commission_description: description || null
      };
      
      if (productToEdit) {
        const { error } = await supabase
          .from('insurance_products')
          .update(productData)
          .eq('id', productToEdit.id);
        if (error) throw error;
        toast({ title: "Succès", description: "Produit modifié" });
      } else {
        const { error } = await supabase
          .from('insurance_products')
          .insert({ ...productData, company_id: productCompanyId });
        if (error) throw error;
        toast({ title: "Succès", description: "Produit créé" });
      }
      
      setProductDialogOpen(false);
      fetchCompanies();
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
        <Button onClick={openAddCompany} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter une compagnie
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
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                        {company.logo_url ? (
                          <img 
                            src={company.logo_url} 
                            alt={company.name} 
                            className="w-10 h-10 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Building2 className="h-6 w-6 text-primary" />
                        )}
                      </div>
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
                          Modifier la compagnie
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAddProduct(company.id)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Ajouter un produit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeleteCompanyDialog(company)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer la compagnie
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
                          Ajouter un produit
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
                                        Modifier le produit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => startEditCommission(product)}>
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        Modifier la commission
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => setDeleteProductDialog(product)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Supprimer
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                <Badge 
                                  variant="secondary" 
                                  className={cn("text-xs mt-1", categoryLabels[product.category]?.color)}
                                >
                                  {categoryLabels[product.category]?.label || product.category}
                                </Badge>
                                
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
                                        <SelectItem value="fixed">Fixe (CHF)</SelectItem>
                                        <SelectItem value="multiplier">Multiplicateur (×)</SelectItem>
                                        <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      type="number"
                                      placeholder={editForm.type === 'fixed' ? 'Montant CHF' : editForm.type === 'multiplier' ? 'Ex: 16' : 'Ex: 4'}
                                      value={editForm.value}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, value: e.target.value }))}
                                      className="h-8 text-xs"
                                    />
                                    <Input
                                      placeholder="Description (optionnel)"
                                      value={editForm.description}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                      className="h-8 text-xs"
                                    />
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs flex-1"
                                        onClick={() => saveProductCommission(product.id)}
                                        disabled={saving || !editForm.value}
                                      >
                                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                                        Sauver
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
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-2">
                                    {formatCommissionDisplay(product.commission_type, product.commission_value, product.commission_description) ? (
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <DollarSign className="h-3 w-3 text-primary" />
                                        <span className="font-medium text-primary">
                                          {formatCommissionDisplay(product.commission_type, product.commission_value, product.commission_description)}
                                        </span>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground italic">
                                        Pas de commission définie
                                      </p>
                                    )}
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

      {/* Company Dialog */}
      <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {companyToEdit ? 'Modifier la compagnie' : 'Ajouter une compagnie'}
            </DialogTitle>
            <DialogDescription>
              {companyToEdit ? 'Modifiez les informations de la compagnie.' : 'Ajoutez une nouvelle compagnie d\'assurance.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom de la compagnie *</Label>
              <Input
                value={companyForm.name}
                onChange={(e) => setCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Groupe Mutuel"
              />
            </div>
            <div className="space-y-2">
              <Label>URL du logo</Label>
              <Input
                value={companyForm.logo_url}
                onChange={(e) => setCompanyForm(prev => ({ ...prev, logo_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Site web</Label>
              <Input
                value={companyForm.website}
                onChange={(e) => setCompanyForm(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://www.example.ch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveCompany} disabled={saving || !companyForm.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {companyToEdit ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {productToEdit ? 'Modifier le produit' : 'Ajouter un produit'}
            </DialogTitle>
            <DialogDescription>
              {productToEdit ? 'Modifiez les informations du produit.' : 'Ajoutez un nouveau produit d\'assurance.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom du produit *</Label>
              <Input
                value={productForm.name}
                onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Assurance complémentaire Optima"
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie *</Label>
              <Select
                value={productForm.category}
                onValueChange={(value) => setProductForm(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={productForm.description}
                onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description du produit..."
                rows={2}
              />
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Configuration de la commission
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type de calcul</Label>
                  <Select
                    value={productForm.commission_type}
                    onValueChange={(value) => setProductForm(prev => ({ ...prev, commission_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixe (CHF)</SelectItem>
                      <SelectItem value="multiplier">Multiplicateur (×)</SelectItem>
                      <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    {productForm.commission_type === 'fixed' ? 'Montant (CHF)' : 
                     productForm.commission_type === 'multiplier' ? 'Multiplicateur' : 'Pourcentage'}
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
                <Label>Description de la formule (optionnel)</Label>
                <Input
                  value={productForm.commission_description}
                  onChange={(e) => setProductForm(prev => ({ ...prev, commission_description: e.target.value }))}
                  placeholder="Ex: Prime mensuelle × 16"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveProduct} disabled={saving || !productForm.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {productToEdit ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Company Confirmation */}
      <AlertDialog open={!!deleteCompanyDialog} onOpenChange={() => setDeleteCompanyDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la compagnie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteCompanyDialog?.name}</strong> ?
              Cette action supprimera également tous les produits associés ({deleteCompanyDialog?.products.length} produits).
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deleteCompany} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Product Confirmation */}
      <AlertDialog open={!!deleteProductDialog} onOpenChange={() => setDeleteProductDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteProductDialog?.name}</strong> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
