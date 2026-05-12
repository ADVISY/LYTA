import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit2, Trash2, Loader2, Sparkles } from 'lucide-react';
import { useTenantBranches, type TenantBranch } from '@/hooks/useTenantBranches';
import { getBranchIcon } from './BranchSelector';

const ICON_CHOICES = [
  'Heart', 'HeartPulse', 'Activity', 'ShieldAlert', 'Sparkles',
  'Briefcase', 'Car', 'Home', 'Scale', 'Plane', 'Building2', 'Landmark', 'Shield',
];

const COLOR_CHOICES = [
  '#10b981', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6',
  '#6366f1', '#3b82f6', '#ec4899', '#64748b', '#0ea5e9',
  '#475569', '#f97316', '#84cc16', '#a855f7',
];

export function TenantBranchesPanel() {
  const { branches, loading, createBranch, updateBranch, toggleActive, deleteBranch } =
    useTenantBranches({ includeInactive: true });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TenantBranch | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    icon: 'Shield',
    color: '#64748b',
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TenantBranch | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', description: '', icon: 'Shield', color: '#64748b' });
    setDialogOpen(true);
  };

  const openEdit = (branch: TenantBranch) => {
    setEditing(branch);
    setForm({
      code: branch.code,
      name: branch.name,
      description: branch.description ?? '',
      icon: branch.icon ?? 'Shield',
      color: branch.color ?? '#64748b',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateBranch(editing.id, {
          // Don't let user edit code on system branches
          ...(editing.is_system ? {} : { code: form.code }),
          name: form.name,
          description: form.description || null,
          icon: form.icon,
          color: form.color,
        });
      } else {
        await createBranch({
          code: form.code || form.name,
          name: form.name,
          description: form.description || null,
          icon: form.icon,
          color: form.color,
          sort_order: 200,
        });
      }
      setDialogOpen(false);
    } catch (e) {
      // toast handled in hook
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Mes branches d'assurance</h3>
          <p className="text-sm text-muted-foreground">
            Les 12 branches standard suisses sont fournies. Tu peux les renommer, les désactiver, ou en ajouter d'autres.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle branche
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => {
          const Icon = getBranchIcon(branch.icon);
          return (
            <Card
              key={branch.id}
              className={`relative transition-opacity ${!branch.is_active ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: `${branch.color || '#64748b'}20`,
                      color: branch.color || '#64748b',
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold truncate">{branch.name}</p>
                      {branch.is_system && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <Sparkles className="h-2.5 w-2.5" />
                          Standard
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{branch.code}</p>
                    {branch.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{branch.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={branch.is_active}
                      onCheckedChange={(checked) => toggleActive(branch.id, checked)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {branch.is_active ? 'Active' : 'Désactivée'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(branch)}
                      title="Modifier"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    {!branch.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(branch)}
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog create/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la branche' : 'Nouvelle branche'}</DialogTitle>
            <DialogDescription>
              {editing?.is_system
                ? "Cette branche est standard. Tu peux changer son nom, icône, couleur, ou la désactiver, mais pas changer son code."
                : "Crée une branche personnalisée pour ton cabinet."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom de la branche *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="ex. Cyber-assurance PME"
              />
            </div>
            {!editing?.is_system && (
              <div className="space-y-2">
                <Label>Code (en majuscules, sans espace)</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="ex. CYBER_PME"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="À quoi sert cette branche ?"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Icône</Label>
                <Select value={form.icon} onValueChange={(v) => setForm((p) => ({ ...p, icon: v }))}>
                  <SelectTrigger>
                    <SelectValue>
                      {(() => {
                        const Icon = getBranchIcon(form.icon);
                        return (
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{form.icon}</span>
                          </div>
                        );
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_CHOICES.map((iconName) => {
                      const Icon = getBranchIcon(iconName);
                      return (
                        <SelectItem key={iconName} value={iconName}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{iconName}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Couleur</Label>
                <div className="grid grid-cols-7 gap-1 p-2 border rounded">
                  {COLOR_CHOICES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, color: c }))}
                      className={`h-6 w-6 rounded transition-all ${form.color === c ? 'ring-2 ring-offset-1 ring-foreground' : ''}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Couleur ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Aperçu :</span>
              <div
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-normal"
                style={{
                  borderColor: `${form.color}40`,
                  backgroundColor: `${form.color}12`,
                  color: form.color,
                }}
              >
                {(() => {
                  const Icon = getBranchIcon(form.icon);
                  return <Icon className="h-3 w-3" />;
                })()}
                {form.name || 'Nom de la branche'}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette branche ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les produits liés à cette branche perdront leur catégorisation. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteTarget) {
                  await deleteBranch(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
