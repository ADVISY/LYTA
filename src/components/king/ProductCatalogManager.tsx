import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductCatalog, ProductMainCategory, InsuranceProductExtended, BRANCH_CODES, BRANCH_LABELS, BranchCode } from "@/hooks/useProductCatalog";
import { useInsuranceCompanies } from "@/hooks/useInsuranceCompanies";
import { DataPagination } from "@/components/ui/DataPagination";
import { useUserRole } from "@/hooks/useUserRole";
import { resolveLifePillarFromProduct, LIFE_PILLAR_BADGES, lifePillarBadgeClasses } from "@/lib/lifePillar";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Tags,
  X,
  CheckCircle,
  Building2,
  Filter,
  Lock,
  GitBranch,
  Clock,
  Sparkles,
} from "lucide-react";

const MAIN_CATEGORIES: { value: ProductMainCategory; label: string; color: string }[] = [
  { value: 'VIE', label: 'Vie / Prévoyance', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  { value: 'LCA', label: 'LCA / Complémentaire', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'NON_VIE', label: 'Non-Vie', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'HYPO', label: 'Hypothèque', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
];

const SUBCATEGORIES: Record<ProductMainCategory, string[]> = {
  VIE: ['3a', '3b', 'risque_deces', 'incapacite', 'mixte'],
  LCA: ['lamal', 'hospitalisation', 'ambulatoire', 'dentaire', 'medecine_naturelle', 'maternite'],
  NON_VIE: ['menage', 'rc_privee', 'auto_rc', 'auto_casco', 'protection_juridique', 'voyage', 'animaux'],
  HYPO: ['taux_fixe', 'taux_variable', 'libor', 'saron'],
};

const MAIN_CATEGORY_TO_LEGACY: Record<ProductMainCategory, string> = {
  VIE: 'life',
  LCA: 'health',
  NON_VIE: 'home',
  HYPO: 'home',
};

interface ProductFormData {
  name: string;
  company_id: string;
  category: string;
  main_category: ProductMainCategory;
  subcategory: string;
  description: string;
  branch_code: BranchCode | '';
  /** Type de pilier (3a/3b/vie_classique). Pertinent uniquement pour les
   *  produits de la branche VIE. '' = non taggé → fallback détection auto sur le nom. */
  life_pillar: 'pilier_3a' | 'pilier_3b' | 'vie_classique' | '';
  aliases: string[];
}

const emptyForm: ProductFormData = {
  name: '',
  company_id: '',
  category: '',
  main_category: 'NON_VIE',
  subcategory: '',
  description: '',
  branch_code: '',
  life_pillar: '',
  aliases: [],
};

// Mapping main_category → branches autorisées (filtre du Select Branche
// pour éviter qu'un produit VIE soit assigné à AUTO etc.)
const BRANCHES_FOR_MAIN: Record<ProductMainCategory, BranchCode[]> = {
  VIE: ['VIE', 'LPP'],
  LCA: ['LAMAL', 'LCA', 'PGM', 'ACCIDENT'],
  NON_VIE: ['AUTO', 'MOTO', 'MENAGE_RC', 'JURIDIQUE', 'VOYAGE', 'ENTREPRISE'],
  HYPO: ['HYPO_CREDIT'],
};

export default function ProductCatalogManager() {
  const { roles } = useUserRole();
  const isKing = roles.includes('king');

  const [filterStatus, setFilterStatus] = useState<'active' | 'pending' | 'all'>('active');
  const [filterBranch, setFilterBranch] = useState<BranchCode | 'all' | 'none'>('all');
  const [filterOrigin, setFilterOrigin] = useState<'all' | 'system' | 'tenant'>('all');

  const { products, loading, page, totalCount, totalPages, goToPage, createProduct, updateProduct, deleteProduct, addAlias, removeAlias, cloneProduct } = useProductCatalog(undefined, { statusFilter: filterStatus });
  const { companies } = useInsuranceCompanies();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<ProductMainCategory | 'all'>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InsuranceProductExtended | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [newAlias, setNewAlias] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [aliasDialogOpen, setAliasDialogOpen] = useState(false);
  const [aliasProduct, setAliasProduct] = useState<InsuranceProductExtended | null>(null);

  // Clone-on-write : IDs des produits système que ce tenant a déjà clonés.
  // Sert à masquer le système correspondant → le tenant voit sa version perso
  // uniquement, jamais le système en doublon. Le king voit tout comme avant.
  const clonedParentIds = new Set(
    products
      .filter(p => (p as any).parent_product_id && p.tenant_id !== null)
      .map(p => (p as any).parent_product_id as string)
  );

  // Filter products
  const filteredProducts = products.filter(p => {
    // Hide système si ce tenant a un clone dérivé (clone-on-write)
    if (!isKing && p.tenant_id === null && clonedParentIds.has(p.id)) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory !== 'all' && p.main_category !== filterCategory) return false;
    if (filterCompany !== 'all' && p.company_id !== filterCompany) return false;
    if (filterBranch === 'none') {
      if (p.branch_code) return false;
    } else if (filterBranch !== 'all') {
      if (p.branch_code !== filterBranch) return false;
    }
    if (filterOrigin === 'system' && p.tenant_id !== null) return false;
    if (filterOrigin === 'tenant' && p.tenant_id === null) return false;
    return true;
  });

  // Un produit système (tenant_id NULL) est verrouillé pour un tenant non-king.
  // Le king peut tout éditer.
  const canEdit = (p: InsuranceProductExtended) => isKing || p.tenant_id !== null;

  const openCreateDialog = () => {
    setEditingProduct(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (product: InsuranceProductExtended) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      company_id: product.company_id,
      category: product.category,
      main_category: product.main_category,
      subcategory: product.subcategory || '',
      description: product.description || '',
      branch_code: product.branch_code ?? '',
      life_pillar: ((product as any).life_pillar ?? '') as ProductFormData['life_pillar'],
      aliases: [],
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.company_id) return;

    setIsSubmitting(true);
    try {
      // Cast `any` ponctuel : life_pillar n'est pas encore dans le type généré
      // de useProductCatalog (sera ajouté au prochain refresh des types Supabase).
      // La colonne existe en DB (migration 20260626180000) + CHECK constraint
      // valide la valeur côté serveur.
      if (editingProduct) {
        // Clone-on-write : si l'user non-king modifie un produit SYSTÈME
        // (tenant_id=NULL), on clone d'abord dans son tenant puis on update
        // le CLONE — jamais le row système partagé. Comportement invisible
        // pour l'utilisateur : il modifie, il save, ses changements restent
        // dans son cabinet. Les autres cabinets ne voient RIEN.
        let targetId = editingProduct.id;
        if (editingProduct.tenant_id === null && !isKing) {
          const cloneId = await cloneProduct(editingProduct.id);
          if (!cloneId) {
            // Erreur déjà loggée par le hook — on stoppe pour ne pas écraser
            // le système par erreur.
            return;
          }
          targetId = cloneId;
        }

        await updateProduct(targetId, {
          name: formData.name,
          company_id: formData.company_id,
          category: formData.category || MAIN_CATEGORY_TO_LEGACY[formData.main_category],
          main_category: formData.main_category,
          subcategory: formData.subcategory || undefined,
          description: formData.description || undefined,
          branch_code: formData.branch_code || null,
          life_pillar: formData.life_pillar || null,
        } as any);
      } else {
        await createProduct({
          name: formData.name,
          company_id: formData.company_id,
          category: formData.category || MAIN_CATEGORY_TO_LEGACY[formData.main_category],
          main_category: formData.main_category,
          subcategory: formData.subcategory || undefined,
          description: formData.description || undefined,
          branch_code: formData.branch_code || null,
          life_pillar: formData.life_pillar || null,
          aliases: formData.aliases,
        } as any);
      }
      setDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidatePending = async (product: InsuranceProductExtended) => {
    if (product.status !== 'pending') return;
    await updateProduct(product.id, { status: 'active' });
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    await deleteProduct(productId);
  };

  const openAliasDialog = (product: InsuranceProductExtended) => {
    setAliasProduct(product);
    setNewAlias('');
    setAliasDialogOpen(true);
  };

  const handleAddAlias = async () => {
    if (!aliasProduct || !newAlias.trim()) return;
    const success = await addAlias(aliasProduct.id, newAlias.trim());
    if (success) {
      setNewAlias('');
      // Refresh alias product
      const updated = products.find(p => p.id === aliasProduct.id);
      if (updated) setAliasProduct(updated);
    }
  };

  const handleRemoveAlias = async (aliasId: string) => {
    await removeAlias(aliasId);
    if (aliasProduct) {
      const updated = products.find(p => p.id === aliasProduct.id);
      if (updated) setAliasProduct(updated);
    }
  };

  const getCategoryBadge = (cat: ProductMainCategory) => {
    const config = MAIN_CATEGORIES.find(c => c.value === cat);
    return config ? (
      <Badge className={config.color}>{config.label}</Badge>
    ) : (
      <Badge variant="secondary">{cat}</Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
            <Package className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Catalogue Produits</h2>
            <p className="text-muted-foreground">
              {products.length} produits ({products.filter(p => p.tenant_id === null).length} système, {products.filter(p => p.tenant_id !== null).length} cabinet)
              • {companies.length} compagnies
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau produit
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un produit..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as ProductMainCategory | 'all')}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {MAIN_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-[200px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Compagnie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes compagnies</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterBranch} onValueChange={(v) => setFilterBranch(v as BranchCode | 'all' | 'none')}>
              <SelectTrigger className="w-[200px]">
                <GitBranch className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Branche" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes branches</SelectItem>
                <SelectItem value="none">⚠️ Sans branche</SelectItem>
                {BRANCH_CODES.map(b => (
                  <SelectItem key={b} value={b}>{BRANCH_LABELS[b]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'active' | 'pending' | 'all')}>
              <SelectTrigger className="w-[160px]">
                <Clock className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="pending">⏳ Pending</SelectItem>
                <SelectItem value="all">Tous</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterOrigin} onValueChange={(v) => setFilterOrigin(v as 'all' | 'system' | 'tenant')}>
              <SelectTrigger className="w-[170px]">
                <Lock className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Origine" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous (système + cabinet)</SelectItem>
                <SelectItem value="system">🔒 Système</SelectItem>
                <SelectItem value="tenant">Mon cabinet</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Compagnie</TableHead>
                  <TableHead>Branche</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Alias</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(product => {
                  const editable = canEdit(product);
                  const isSystem = product.tenant_id === null;
                  const isPending = product.status === 'pending';
                  return (
                    <TableRow key={product.id} className={isPending ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{product.name}</p>
                            {/* Badge pilier 3A/3B/Vie classique.
                                Priorité : (1) life_pillar taggé manuellement par admin/king
                                dans le catalogue > (2) détection auto regex sur le nom. */}
                            {(() => {
                              const pillar = resolveLifePillarFromProduct(product as any);
                              if (!pillar) return null;
                              const info = LIFE_PILLAR_BADGES[pillar];
                              const isManual = (product as any).life_pillar === pillar;
                              return (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${lifePillarBadgeClasses(pillar)}`}
                                  title={`${info.description}${isManual ? ' (taggé manuellement)' : ' (détection auto)'}`}
                                >
                                  {info.label}
                                </Badge>
                              );
                            })()}
                          </div>
                          {product.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{product.company?.name || '-'}</span>
                      </TableCell>
                      <TableCell>
                        {product.branch_code ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {product.branch_code}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-400">
                            ⚠ Aucune
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {getCategoryBadge(product.main_category)}
                      </TableCell>
                      <TableCell>
                        {isSystem ? (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Système
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Mon cabinet
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isPending ? (
                          <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                            Pending
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-700 border-green-300">
                            Actif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAliasDialog(product)}
                          className="gap-1"
                          disabled={!editable}
                          title={!editable ? 'Produit système — verrouillé' : undefined}
                        >
                          <Tags className="h-3 w-3" />
                          {product.aliases?.length || 0}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isPending && editable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleValidatePending(product)}
                              className="text-green-700 hover:text-green-800"
                              title="Valider ce produit pending"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(product)}
                            title={editable ? 'Modifier' : 'Voir (lecture seule — produit système)'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product.id)}
                            className="text-destructive hover:text-destructive"
                            disabled={!editable}
                            title={!editable ? 'Produit système — non supprimable' : 'Supprimer'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      Aucun produit trouvé
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={goToPage}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du produit *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: LAMal FAVORIT MEDPHARM"
                // Champs déverrouillés même pour un produit système : le save
                // déclenchera un clone-on-write automatique (cf. handleSubmit).
                disabled={false}
              />
            </div>

            {/* Info discrète : signale que la modif d'un produit système va
                créer une copie privée automatique au save. UX plus fluide
                qu'un bouton explicite : l'user modifie, click Save, c'est
                cloné en fond. */}
            {editingProduct && editingProduct.tenant_id === null && !isKing && (
              <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-2 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Ce produit fait partie du catalogue partagé. En enregistrant tes modifications,
                  une <strong>copie privée sera créée pour ton cabinet</strong>. Les autres cabinets ne verront
                  PAS tes changements.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Compagnie *</Label>
              <Select
                value={formData.company_id}
                onValueChange={(v) => setFormData(f => ({ ...f, company_id: v }))}
                disabled={false}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une compagnie" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Catégorie principale *</Label>
                <Select
                  value={formData.main_category}
                  onValueChange={(v) => setFormData(f => ({
                    ...f,
                    main_category: v as ProductMainCategory,
                    subcategory: '',
                    branch_code: BRANCHES_FOR_MAIN[v as ProductMainCategory].includes(f.branch_code as BranchCode) ? f.branch_code : '',
                  }))}
                  disabled={false}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAIN_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Branche *</Label>
                <Select
                  value={formData.branch_code || 'none'}
                  onValueChange={(v) => setFormData(f => ({ ...f, branch_code: v === 'none' ? '' : (v as BranchCode) }))}
                  disabled={false}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {BRANCHES_FOR_MAIN[formData.main_category].map(b => (
                      <SelectItem key={b} value={b}>
                        <span className="font-mono mr-2">{b}</span> {BRANCH_LABELS[b]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sous-catégorie</Label>
              <Select
                value={formData.subcategory || "none"}
                onValueChange={(v) => setFormData(f => ({ ...f, subcategory: v === "none" ? "" : v }))}
                disabled={false}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optionnel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {SUBCATEGORIES[formData.main_category]?.map(sub => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selector Pilier (3A/3B/Vie classique) — visible UNIQUEMENT pour
                les produits de la branche VIE. Permet à l'admin/king de tagger
                un produit dont le nom commercial ne contient pas "3a"/"3b"
                (ex: "Swiss Life Dynamic Elements"). Le tag s'applique par
                défaut à TOUS les contrats créés avec ce produit, et le courtier
                peut overrider sur un contrat précis via le selector du
                ContractForm (qui stocke dans products_data.pillarType). */}
            {formData.main_category === 'VIE' && (
              <div className="space-y-2">
                <Label>Type de pilier (par défaut)</Label>
                <Select
                  value={formData.life_pillar || 'none'}
                  onValueChange={(v) => setFormData(f => ({
                    ...f,
                    life_pillar: v === 'none' ? '' : (v as ProductFormData['life_pillar']),
                  }))}
                  // Champs déverrouillés même pour un produit système : le save
                // déclenchera un clone-on-write automatique (cf. handleSubmit).
                disabled={false}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-détecté depuis le nom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Auto-détecté depuis le nom</SelectItem>
                    <SelectItem value="pilier_3a">3ᵉ pilier A (lié, déductible)</SelectItem>
                    <SelectItem value="pilier_3b">3ᵉ pilier B (libre)</SelectItem>
                    <SelectItem value="vie_classique">Vie classique (risque, mixte, rente)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Si tu laisses sur "auto-détecté", on devine depuis le nom du produit.
                  Tagger explicitement utile pour les noms commerciaux (ex: "Swiss Life Dynamic Elements").
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Catégorie legacy</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))}
                placeholder="Ex: health, life, auto..."
                // Champs déverrouillés même pour un produit système : le save
                // déclenchera un clone-on-write automatique (cf. handleSubmit).
                disabled={false}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder="Description optionnelle..."
                rows={2}
                // Champs déverrouillés même pour un produit système : le save
                // déclenchera un clone-on-write automatique (cf. handleSubmit).
                disabled={false}
              />
            </div>

            {!editingProduct && (
              <div className="space-y-2">
                <Label>Alias (synonymes)</Label>
                <div className="flex gap-2">
                  <Input
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    placeholder="Ex: RC privée"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newAlias.trim()) {
                        e.preventDefault();
                        setFormData(f => ({ ...f, aliases: [...f.aliases, newAlias.trim()] }));
                        setNewAlias('');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (newAlias.trim()) {
                        setFormData(f => ({ ...f, aliases: [...f.aliases, newAlias.trim()] }));
                        setNewAlias('');
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.aliases.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.aliases.map((alias, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {alias}
                        <button
                          type="button"
                          onClick={() => setFormData(f => ({
                            ...f,
                            aliases: f.aliases.filter((_, idx) => idx !== i)
                          }))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            {/* Bouton Save toujours visible — le clone-on-write s'occupera
                automatiquement de créer une copie privée si l'user modifie
                un produit système (cf. handleSubmit). */}
            <Button onClick={handleSubmit} disabled={isSubmitting || !formData.name || !formData.company_id}>
              {isSubmitting ? 'Enregistrement...' : (editingProduct ? 'Modifier' : 'Créer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alias Dialog */}
      <Dialog open={aliasDialogOpen} onOpenChange={setAliasDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              Alias / Synonymes
            </DialogTitle>
          </DialogHeader>

          {aliasProduct && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Produit: <strong>{aliasProduct.name}</strong>
              </p>

              <div className="flex gap-2">
                <Input
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  placeholder="Nouvel alias..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAlias();
                    }
                  }}
                />
                <Button onClick={handleAddAlias} disabled={!newAlias.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {aliasProduct.aliases?.map(alias => (
                  <div key={alias.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                    <span>{alias.alias}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAlias(alias.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {(!aliasProduct.aliases || aliasProduct.aliases.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun alias configuré
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Les alias permettent à l'IA de reconnaître le produit même si le nom 
                dans le document est différent (ex: "RC privée" → "Responsabilité civile privée").
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
