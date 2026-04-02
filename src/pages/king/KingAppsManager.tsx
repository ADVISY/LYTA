import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Pencil,
  Trash2,
  Globe,
  Search,
  AppWindow,
  AlertTriangle,
} from 'lucide-react';

interface ExternalApp {
  id: string;
  slug: string;
  name: string;
  category: string;
  description_short: string | null;
  description_long: string | null;
  logo_url: string | null;
  connection_type: string;
  launch_mode: string;
  launch_url: string | null;
  embed_allowed: boolean;
  oauth_supported: boolean;
  smartflow_compatible: boolean;
  integration_level: number;
  is_premium: boolean;
  is_beta: boolean;
  is_active: boolean;
  sort_order: number;
}

const emptyApp: Partial<ExternalApp> = {
  slug: '',
  name: '',
  category: 'productivite',
  description_short: '',
  description_long: '',
  logo_url: '',
  connection_type: 'link',
  launch_mode: 'new_tab',
  launch_url: '',
  embed_allowed: false,
  oauth_supported: false,
  smartflow_compatible: false,
  integration_level: 1,
  is_premium: false,
  is_beta: false,
  is_active: true,
  sort_order: 100,
};

const categories = [
  { value: 'communication', label: 'Communication' },
  { value: 'stockage', label: 'Stockage' },
  { value: 'productivite', label: 'Productivité' },
  { value: 'finance', label: 'Finance' },
  { value: 'signature', label: 'Signature' },
  { value: 'ia', label: 'IA / Automatisation' },
  { value: 'telephonie', label: 'Téléphonie' },
];

export default function KingAppsManager() {
  const { toast } = useToast();
  const [apps, setApps] = useState<ExternalApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editApp, setEditApp] = useState<Partial<ExternalApp> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ExternalApp | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchApps = useCallback(async () => {
    const { data, error } = await supabase
      .from('external_apps')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching apps:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les applications.', variant: 'destructive' });
    } else {
      setApps(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const handleSave = async () => {
    if (!editApp?.name || !editApp?.slug) {
      toast({ title: 'Erreur', description: 'Le nom et le slug sont requis.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (isCreating) {
        const { error } = await supabase.from('external_apps').insert({
          slug: editApp.slug!,
          name: editApp.name!,
          category: editApp.category || 'productivite',
          description_short: editApp.description_short || null,
          description_long: editApp.description_long || null,
          logo_url: editApp.logo_url || null,
          connection_type: editApp.connection_type || 'link',
          launch_mode: editApp.launch_mode || 'new_tab',
          launch_url: editApp.launch_url || null,
          embed_allowed: editApp.embed_allowed ?? false,
          oauth_supported: editApp.oauth_supported ?? false,
          smartflow_compatible: editApp.smartflow_compatible ?? false,
          integration_level: editApp.integration_level ?? 1,
          is_premium: editApp.is_premium ?? false,
          is_beta: editApp.is_beta ?? false,
          is_active: editApp.is_active ?? true,
          sort_order: editApp.sort_order ?? 100,
        } as any);
        if (error) throw error;
        toast({ title: 'Application créée', description: `${editApp.name} a été ajoutée au catalogue.` });
      } else {
        const { error } = await supabase
          .from('external_apps')
          .update({
            slug: editApp.slug!,
            name: editApp.name!,
            category: editApp.category,
            description_short: editApp.description_short || null,
            description_long: editApp.description_long || null,
            logo_url: editApp.logo_url || null,
            connection_type: editApp.connection_type,
            launch_mode: editApp.launch_mode,
            launch_url: editApp.launch_url || null,
            embed_allowed: editApp.embed_allowed,
            oauth_supported: editApp.oauth_supported,
            smartflow_compatible: editApp.smartflow_compatible,
            integration_level: editApp.integration_level,
            is_premium: editApp.is_premium,
            is_beta: editApp.is_beta,
            is_active: editApp.is_active,
            sort_order: editApp.sort_order,
          } as any)
          .eq('id', editApp.id!);
        if (error) throw error;
        toast({ title: 'Application modifiée', description: `${editApp.name} a été mise à jour.` });
      }
      setEditApp(null);
      setIsCreating(false);
      await fetchApps();
    } catch (err: any) {
      console.error('Save error:', err);
      toast({ title: 'Erreur', description: err.message || 'Impossible de sauvegarder.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('external_apps')
        .delete()
        .eq('id', deleteConfirm.id);
      if (error) throw error;
      toast({ title: 'Application supprimée', description: `${deleteConfirm.name} a été retirée du catalogue.` });
      setDeleteConfirm(null);
      await fetchApps();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Impossible de supprimer.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const filteredApps = apps.filter(app => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return app.name.toLowerCase().includes(q) || app.slug.toLowerCase().includes(q) || app.category.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AppWindow className="w-6 h-6 text-amber-500" />
            Gestion des Applications
          </h1>
          <p className="text-sm text-muted-foreground">
            Gérez le catalogue d'applications LYTA Tools disponibles pour tous les tenants.
          </p>
        </div>
        <Button onClick={() => { setEditApp({ ...emptyApp }); setIsCreating(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle application
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, slug ou catégorie..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Catalogue ({filteredApps.length} application{filteredApps.length !== 1 ? 's' : ''})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Actif</TableHead>
                  <TableHead className="text-center">Embed</TableHead>
                  <TableHead className="text-center">Ordre</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApps.map(app => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                          {app.logo_url ? (
                            <img src={app.logo_url} alt={app.name} className="w-5 h-5 object-contain" />
                          ) : (
                            <Globe className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{app.name}</p>
                          <p className="text-xs text-muted-foreground">{app.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{app.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {app.is_premium && <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200">Premium</Badge>}
                        {app.is_beta && <Badge className="text-[10px] bg-violet-500/10 text-violet-600 border-violet-200">Bêta</Badge>}
                        {app.oauth_supported && <Badge className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-200">OAuth</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={`w-2 h-2 rounded-full mx-auto ${app.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={`w-2 h-2 rounded-full mx-auto ${app.embed_allowed ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {app.sort_order}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setEditApp({ ...app }); setIsCreating(false); }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(app)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredApps.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucune application trouvée.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit / Create Dialog */}
      <Dialog open={!!editApp} onOpenChange={(open) => { if (!open) { setEditApp(null); setIsCreating(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? 'Nouvelle application' : `Modifier ${editApp?.name}`}</DialogTitle>
            <DialogDescription>
              {isCreating ? 'Ajoutez une nouvelle application au catalogue LYTA Tools.' : 'Modifiez les paramètres de cette application.'}
            </DialogDescription>
          </DialogHeader>

          {editApp && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input value={editApp.name || ''} onChange={(e) => setEditApp({ ...editApp, name: e.target.value })} placeholder="Gmail" />
                </div>
                <div className="space-y-2">
                  <Label>Slug *</Label>
                  <Input value={editApp.slug || ''} onChange={(e) => setEditApp({ ...editApp, slug: e.target.value })} placeholder="gmail" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select value={editApp.category || 'productivite'} onValueChange={(v) => setEditApp({ ...editApp, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ordre d'affichage</Label>
                  <Input type="number" value={editApp.sort_order ?? 100} onChange={(e) => setEditApp({ ...editApp, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description courte</Label>
                <Input value={editApp.description_short || ''} onChange={(e) => setEditApp({ ...editApp, description_short: e.target.value })} placeholder="Client email professionnel" />
              </div>

              <div className="space-y-2">
                <Label>Description longue</Label>
                <Textarea value={editApp.description_long || ''} onChange={(e) => setEditApp({ ...editApp, description_long: e.target.value })} rows={3} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>URL du logo</Label>
                  <Input value={editApp.logo_url || ''} onChange={(e) => setEditApp({ ...editApp, logo_url: e.target.value })} placeholder="/images/app-logos/gmail.png" />
                </div>
                <div className="space-y-2">
                  <Label>URL de lancement</Label>
                  <Input value={editApp.launch_url || ''} onChange={(e) => setEditApp({ ...editApp, launch_url: e.target.value })} placeholder="https://mail.google.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type de connexion</Label>
                  <Select value={editApp.connection_type || 'link'} onValueChange={(v) => setEditApp({ ...editApp, connection_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="link">Lien simple</SelectItem>
                      <SelectItem value="oauth">OAuth</SelectItem>
                      <SelectItem value="api_key">Clé API</SelectItem>
                      <SelectItem value="embed">Embed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mode de lancement</Label>
                  <Select value={editApp.launch_mode || 'new_tab'} onValueChange={(v) => setEditApp({ ...editApp, launch_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_tab">Nouvel onglet</SelectItem>
                      <SelectItem value="embed">iFrame intégrée</SelectItem>
                      <SelectItem value="popup">Popup</SelectItem>
                      <SelectItem value="native">Natif (API)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Niveau d'intégration (1-5)</Label>
                <Input type="number" min={1} max={5} value={editApp.integration_level ?? 1} onChange={(e) => setEditApp({ ...editApp, integration_level: parseInt(e.target.value) || 1 })} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={editApp.is_active ?? true} onCheckedChange={(v) => setEditApp({ ...editApp, is_active: v })} />
                  <Label className="text-sm">Actif</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editApp.embed_allowed ?? false} onCheckedChange={(v) => setEditApp({ ...editApp, embed_allowed: v })} />
                  <Label className="text-sm">Embed autorisé</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editApp.oauth_supported ?? false} onCheckedChange={(v) => setEditApp({ ...editApp, oauth_supported: v })} />
                  <Label className="text-sm">OAuth</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editApp.smartflow_compatible ?? false} onCheckedChange={(v) => setEditApp({ ...editApp, smartflow_compatible: v })} />
                  <Label className="text-sm">SmartFlow</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editApp.is_premium ?? false} onCheckedChange={(v) => setEditApp({ ...editApp, is_premium: v })} />
                  <Label className="text-sm">Premium</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editApp.is_beta ?? false} onCheckedChange={(v) => setEditApp({ ...editApp, is_beta: v })} />
                  <Label className="text-sm">Bêta</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditApp(null); setIsCreating(false); }}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement...' : isCreating ? 'Créer' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Supprimer l'application
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteConfirm?.name}</strong> du catalogue ? Cette action supprimera aussi toutes les connexions utilisateurs et paramètres tenant associés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
