import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Package, Search, ChevronDown, ChevronRight, Loader2, Users, Globe, Phone, Edit2, Check, X, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  products: Product[];
};

const getCategoryLabels = (t: any): Record<string, { label: string; color: string }> => ({
  health: { label: t('settings.categoryHealth'), color: "bg-emerald-100 text-emerald-700" },
  auto: { label: t('settings.categoryAuto'), color: "bg-blue-100 text-blue-700" },
  home: { label: t('settings.categoryProperty'), color: "bg-amber-100 text-amber-700" },
  life: { label: t('settings.categoryLife'), color: "bg-violet-100 text-violet-700" },
  legal: { label: t('settings.categoryLegal'), color: "bg-slate-100 text-slate-700" },
  lamal: { label: "LAMal", color: "bg-teal-100 text-teal-700" },
  lca: { label: "LCA", color: "bg-cyan-100 text-cyan-700" },
});

const getCommissionTypeLabel = (type: string | null) => {
  switch (type) {
    case 'fixed': return 'Fixe (CHF)';
    case 'multiplier': return 'Multiplicateur (×)';
    case 'percentage': return 'Pourcentage (%)';
    default: return 'Non défini';
  }
};

const formatCommissionDisplay = (type: string | null, value: number | null, description: string | null) => {
  if (!type || value === null || value === 0) return null;
  
  switch (type) {
    case 'fixed': return `${value} CHF`;
    case 'multiplier': return `Prime × ${value}`;
    case 'percentage': return `${value}%`;
    default: return description || null;
  }
};

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
  const categoryLabels = getCategoryLabels(t);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      
      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('insurance_companies')
        .select('*')
        .order('name');
      
      if (companiesError) throw companiesError;

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('insurance_products')
        .select('*')
        .order('category, name');
      
      if (productsError) throw productsError;

      // Group products by company
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

  const startEditProduct = (product: Product) => {
    setEditingProduct(product.id);
    setEditForm({
      type: product.commission_type || 'multiplier',
      value: product.commission_value?.toString() || '',
      description: product.commission_description || ''
    });
  };

  const cancelEditProduct = () => {
    setEditingProduct(null);
    setEditForm({ type: 'multiplier', value: '', description: '' });
  };

  const saveProductCommission = async (productId: string) => {
    try {
      setSaving(true);
      
      // Generate description based on type
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

      toast({
        title: "Succès",
        description: "Commission mise à jour"
      });

      setEditingProduct(null);
      fetchCompanies();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
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
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('companies.title')}</h1>
            <p className="text-muted-foreground">{t('companies.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('companies.companies')}</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">
              {companies.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('companies.products')}</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">
              {totalProducts}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('settings.categoryHealth')}</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-violet-500 to-violet-600 bg-clip-text text-transparent">
              {companies.reduce((sum, c) => sum + c.products.filter(p => p.category === 'health').length, 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-card/80 backdrop-blur">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t('settings.categoryAuto')}/{t('settings.categoryProperty')}</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent">
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
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
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
                      {openCompanies.has(company.id) ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
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
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {company.products.map((product) => (
                          <div
                            key={product.id}
                            className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-background">
                                <Package className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-medium text-sm truncate">{product.name}</p>
                                  {editingProduct !== product.id && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0"
                                      onClick={() => startEditProduct(product)}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  )}
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
                                        onClick={cancelEditProduct}
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
                                        <DollarSign className="h-3 w-3 text-emerald-600" />
                                        <span className="font-medium text-emerald-700">
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
    </div>
  );
}
