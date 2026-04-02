import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Package, Plus, Edit, Trash2, Check, X, Crown, Zap, 
  Users, FileCheck, DollarSign, FileText, UserPlus, Wallet,
  Mail, FileSignature, Globe, LayoutDashboard, Settings, QrCode,
  GripVertical, Save, Loader2
} from "lucide-react";

interface PlatformPlan {
  id: string;
  display_name: string;
  description: string | null;
  monthly_price: number;
  seats_included: number;
  extra_seat_price: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  is_active: boolean;
  sort_order: number;
}

interface PlatformModule {
  id: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  category: string;
  sort_order: number;
}

interface PlanModule {
  plan_id: string;
  module_id: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users, FileCheck, DollarSign, FileText, UserPlus, Wallet,
  Mail, Zap, FileSignature, Globe, LayoutDashboard, Settings, QrCode
};

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Fonctionnalités de base',
  finance: 'Finance',
  marketing: 'Marketing',
  advanced: 'Avancé',
  premium: 'Premium',
  general: 'Général'
};

const CATEGORY_COLORS: Record<string, string> = {
  core: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  finance: 'bg-green-500/10 text-green-600 border-green-500/20',
  marketing: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  advanced: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  premium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  general: 'bg-gray-500/10 text-gray-600 border-gray-500/20'
};

export default function KingPlans() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [planModules, setPlanModules] = useState<PlanModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Dialogs
  const [editPlanDialog, setEditPlanDialog] = useState(false);
  const [editModuleDialog, setEditModuleDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlatformPlan | null>(null);
  const [editingModule, setEditingModule] = useState<PlatformModule | null>(null);

  // Form states
  const [planForm, setPlanForm] = useState({
    id: '',
    display_name: '',
    description: '',
    monthly_price: 0,
    seats_included: 1,
    extra_seat_price: 20,
    stripe_product_id: '',
    stripe_price_id: '',
    is_active: true
  });

  const [moduleForm, setModuleForm] = useState({
    id: '',
    display_name: '',
    description: '',
    icon: 'Package',
    category: 'general'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, modulesRes, planModulesRes] = await Promise.all([
        supabase.from('platform_plans').select('*').order('sort_order'),
        supabase.from('platform_modules').select('*').order('sort_order'),
        supabase.from('plan_modules').select('plan_id, module_id')
      ]);

      if (plansRes.data) setPlans(plansRes.data);
      if (modulesRes.data) setModules(modulesRes.data);
      if (planModulesRes.data) setPlanModules(planModulesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleModule = async (planId: string, moduleId: string) => {
    const exists = planModules.some(pm => pm.plan_id === planId && pm.module_id === moduleId);
    
    setSaving(true);
    try {
      if (exists) {
        const { error } = await supabase
          .from('plan_modules')
          .delete()
          .eq('plan_id', planId)
          .eq('module_id', moduleId);
        
        if (error) throw error;
        setPlanModules(prev => prev.filter(pm => !(pm.plan_id === planId && pm.module_id === moduleId)));
      } else {
        const { error } = await supabase
          .from('plan_modules')
          .insert({ plan_id: planId, module_id: moduleId });
        
        if (error) throw error;
        setPlanModules(prev => [...prev, { plan_id: planId, module_id: moduleId }]);
      }
      toast.success('Configuration mise à jour');
    } catch (error) {
      console.error('Error toggling module:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const openEditPlan = (plan?: PlatformPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        id: plan.id,
        display_name: plan.display_name,
        description: plan.description || '',
        monthly_price: plan.monthly_price,
        seats_included: plan.seats_included,
        extra_seat_price: plan.extra_seat_price,
        stripe_product_id: plan.stripe_product_id || '',
        stripe_price_id: plan.stripe_price_id || '',
        is_active: plan.is_active
      });
    } else {
      setEditingPlan(null);
      setPlanForm({
        id: '',
        display_name: '',
        description: '',
        monthly_price: 0,
        seats_included: 1,
        extra_seat_price: 20,
        stripe_product_id: '',
        stripe_price_id: '',
        is_active: true
      });
    }
    setEditPlanDialog(true);
  };

  const savePlan = async () => {
    if (!planForm.id || !planForm.display_name) {
      toast.error('ID et nom requis');
      return;
    }

    setSaving(true);
    try {
      const data = {
        id: planForm.id,
        display_name: planForm.display_name,
        description: planForm.description || null,
        monthly_price: planForm.monthly_price,
        seats_included: planForm.seats_included,
        extra_seat_price: planForm.extra_seat_price,
        stripe_product_id: planForm.stripe_product_id || null,
        stripe_price_id: planForm.stripe_price_id || null,
        is_active: planForm.is_active,
        sort_order: editingPlan ? editingPlan.sort_order : plans.length + 1
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('platform_plans')
          .update(data)
          .eq('id', editingPlan.id);
        if (error) throw error;
        setPlans(prev => prev.map(p => p.id === editingPlan.id ? { ...p, ...data } : p));
      } else {
        const { error } = await supabase
          .from('platform_plans')
          .insert(data);
        if (error) throw error;
        setPlans(prev => [...prev, data as PlatformPlan]);
      }

      toast.success(editingPlan ? 'Plan mis à jour' : 'Plan créé');
      setEditPlanDialog(false);
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm('Supprimer ce plan ? Les tenants utilisant ce plan ne seront pas affectés immédiatement.')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('platform_plans')
        .delete()
        .eq('id', planId);
      if (error) throw error;
      setPlans(prev => prev.filter(p => p.id !== planId));
      toast.success('Plan supprimé');
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  const openEditModule = (module?: PlatformModule) => {
    if (module) {
      setEditingModule(module);
      setModuleForm({
        id: module.id,
        display_name: module.display_name,
        description: module.description || '',
        icon: module.icon || 'Package',
        category: module.category
      });
    } else {
      setEditingModule(null);
      setModuleForm({
        id: '',
        display_name: '',
        description: '',
        icon: 'Package',
        category: 'general'
      });
    }
    setEditModuleDialog(true);
  };

  const saveModule = async () => {
    if (!moduleForm.id || !moduleForm.display_name) {
      toast.error('ID et nom requis');
      return;
    }

    setSaving(true);
    try {
      const data = {
        id: moduleForm.id,
        display_name: moduleForm.display_name,
        description: moduleForm.description || null,
        icon: moduleForm.icon,
        category: moduleForm.category,
        sort_order: editingModule ? editingModule.sort_order : modules.length + 1
      };

      if (editingModule) {
        const { error } = await supabase
          .from('platform_modules')
          .update(data)
          .eq('id', editingModule.id);
        if (error) throw error;
        setModules(prev => prev.map(m => m.id === editingModule.id ? { ...m, ...data } : m));
      } else {
        const { error } = await supabase
          .from('platform_modules')
          .insert(data);
        if (error) throw error;
        setModules(prev => [...prev, data as PlatformModule]);
      }

      toast.success(editingModule ? 'Module mis à jour' : 'Module créé');
      setEditModuleDialog(false);
    } catch (error: any) {
      console.error('Error saving module:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const deleteModule = async (moduleId: string) => {
    if (!confirm('Supprimer ce module ? Il sera retiré de tous les plans.')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('platform_modules')
        .delete()
        .eq('id', moduleId);
      if (error) throw error;
      setModules(prev => prev.filter(m => m.id !== moduleId));
      setPlanModules(prev => prev.filter(pm => pm.module_id !== moduleId));
      toast.success('Module supprimé');
    } catch (error: any) {
      console.error('Error deleting module:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  const modulesByCategory = modules.reduce((acc, module) => {
    if (!acc[module.category]) acc[module.category] = [];
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, PlatformModule[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Offres</h1>
          <p className="text-muted-foreground">
            Configurez les plans et leurs fonctionnalités pour tous les tenants
          </p>
        </div>
      </div>

      <Tabs defaultValue="matrix" className="space-y-6">
        <TabsList>
          <TabsTrigger value="matrix">Matrice des accès</TabsTrigger>
          <TabsTrigger value="plans">Plans ({plans.length})</TabsTrigger>
          <TabsTrigger value="modules">Modules ({modules.length})</TabsTrigger>
        </TabsList>

        {/* ACCESS MATRIX TAB */}
        <TabsContent value="matrix" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-amber-500" />
                Matrice Plan → Modules
              </CardTitle>
              <CardDescription>
                Cochez les modules inclus dans chaque plan. Les changements s'appliquent immédiatement à tous les tenants.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Module</th>
                      {plans.map(plan => (
                        <th key={plan.id} className="text-center p-3 font-medium min-w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <span>{plan.display_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {plan.monthly_price} CHF
                            </Badge>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(modulesByCategory).map(([category, categoryModules]) => (
                      <>
                        <tr key={`cat-${category}`} className="bg-muted/50">
                          <td colSpan={plans.length + 1} className="p-2">
                            <Badge className={CATEGORY_COLORS[category] || CATEGORY_COLORS.general}>
                              {CATEGORY_LABELS[category] || category}
                            </Badge>
                          </td>
                        </tr>
                        {categoryModules.map(module => {
                          const IconComponent = ICON_MAP[module.icon || 'Package'];
                          return (
                            <tr key={module.id} className="border-b hover:bg-muted/30">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {IconComponent && <IconComponent className="h-4 w-4 text-muted-foreground" />}
                                  <span className="font-medium">{module.display_name}</span>
                                </div>
                                {module.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{module.description}</p>
                                )}
                              </td>
                              {plans.map(plan => {
                                const isEnabled = planModules.some(
                                  pm => pm.plan_id === plan.id && pm.module_id === module.id
                                );
                                return (
                                  <td key={`${plan.id}-${module.id}`} className="text-center p-3">
                                    <Checkbox
                                      checked={isEnabled}
                                      onCheckedChange={() => handleToggleModule(plan.id, module.id)}
                                      disabled={saving}
                                      className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLANS TAB */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openEditPlan()} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Plan
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {plans.map(plan => (
              <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-amber-500" />
                        {plan.display_name}
                      </CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditPlan(plan)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive"
                        onClick={() => deletePlan(plan.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-3xl font-bold">
                    {plan.monthly_price} <span className="text-sm font-normal text-muted-foreground">CHF/mois</span>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sièges inclus</span>
                      <span>{plan.seats_included}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Siège supp.</span>
                      <span>{plan.extra_seat_price} CHF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modules</span>
                      <span>{planModules.filter(pm => pm.plan_id === plan.id).length}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Actif</span>
                    <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                      {plan.is_active ? 'Oui' : 'Non'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* MODULES TAB */}
        <TabsContent value="modules" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openEditModule()} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Module
            </Button>
          </div>

          {Object.entries(modulesByCategory).map(([category, categoryModules]) => (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Badge className={CATEGORY_COLORS[category] || CATEGORY_COLORS.general}>
                    {CATEGORY_LABELS[category] || category}
                  </Badge>
                  <span className="text-sm font-normal text-muted-foreground">
                    ({categoryModules.length} modules)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {categoryModules.map(module => {
                    const IconComponent = ICON_MAP[module.icon || 'Package'];
                    const plansWithModule = plans.filter(p => 
                      planModules.some(pm => pm.plan_id === p.id && pm.module_id === module.id)
                    );
                    
                    return (
                      <div 
                        key={module.id}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50"
                      >
                        <div className="p-2 rounded-lg bg-primary/10">
                          {IconComponent && <IconComponent className="h-5 w-5 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{module.display_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{module.description}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {plansWithModule.map(p => (
                              <Badge key={p.id} variant="outline" className="text-xs">
                                {p.display_name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModule(module)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteModule(module.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* EDIT PLAN DIALOG */}
      <Dialog open={editPlanDialog} onOpenChange={setEditPlanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Modifier le plan' : 'Nouveau plan'}</DialogTitle>
            <DialogDescription>
              Configurez les détails du plan tarifaire
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID technique *</Label>
                <Input
                  value={planForm.id}
                  onChange={e => setPlanForm({ ...planForm, id: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                  placeholder="pro"
                  disabled={!!editingPlan}
                />
              </div>
              <div className="space-y-2">
                <Label>Nom affiché *</Label>
                <Input
                  value={planForm.display_name}
                  onChange={e => setPlanForm({ ...planForm, display_name: e.target.value })}
                  placeholder="Pro"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={planForm.description}
                onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
                placeholder="Pour les cabinets établis"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Prix/mois (CHF)</Label>
                <Input
                  type="number"
                  value={planForm.monthly_price}
                  onChange={e => setPlanForm({ ...planForm, monthly_price: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sièges inclus</Label>
                <Input
                  type="number"
                  value={planForm.seats_included}
                  onChange={e => setPlanForm({ ...planForm, seats_included: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Siège supp.</Label>
                <Input
                  type="number"
                  value={planForm.extra_seat_price}
                  onChange={e => setPlanForm({ ...planForm, extra_seat_price: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stripe Product ID</Label>
                <Input
                  value={planForm.stripe_product_id}
                  onChange={e => setPlanForm({ ...planForm, stripe_product_id: e.target.value })}
                  placeholder="prod_xxx"
                />
              </div>
              <div className="space-y-2">
                <Label>Stripe Price ID</Label>
                <Input
                  value={planForm.stripe_price_id}
                  onChange={e => setPlanForm({ ...planForm, stripe_price_id: e.target.value })}
                  placeholder="price_xxx"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Plan actif</Label>
              <Switch
                checked={planForm.is_active}
                onCheckedChange={checked => setPlanForm({ ...planForm, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlanDialog(false)}>
              Annuler
            </Button>
            <Button onClick={savePlan} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPlan ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT MODULE DIALOG */}
      <Dialog open={editModuleDialog} onOpenChange={setEditModuleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingModule ? 'Modifier le module' : 'Nouveau module'}</DialogTitle>
            <DialogDescription>
              Configurez les détails du module
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID technique *</Label>
                <Input
                  value={moduleForm.id}
                  onChange={e => setModuleForm({ ...moduleForm, id: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                  placeholder="crm_advanced"
                  disabled={!!editingModule}
                />
              </div>
              <div className="space-y-2">
                <Label>Nom affiché *</Label>
                <Input
                  value={moduleForm.display_name}
                  onChange={e => setModuleForm({ ...moduleForm, display_name: e.target.value })}
                  placeholder="CRM Avancé"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={moduleForm.description}
                onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })}
                placeholder="Fonctionnalités CRM avancées"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icône</Label>
                <Select 
                  value={moduleForm.icon} 
                  onValueChange={value => setModuleForm({ ...moduleForm, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(ICON_MAP).map(iconName => (
                      <SelectItem key={iconName} value={iconName}>
                        {iconName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select 
                  value={moduleForm.category} 
                  onValueChange={value => setModuleForm({ ...moduleForm, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModuleDialog(false)}>
              Annuler
            </Button>
            <Button onClick={saveModule} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingModule ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
