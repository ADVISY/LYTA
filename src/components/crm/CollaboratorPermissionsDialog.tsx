import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Shield, Eye, Plus, Pencil, Trash2 } from "lucide-react";
import { useCollaboratorPermissions, MODULES, PermissionModule, PermissionUpdate } from "@/hooks/useCollaboratorPermissions";
import { Collaborateur } from "@/hooks/useCollaborateurs";
import { cn } from "@/lib/utils";

interface CollaboratorPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborateur: Collaborateur | null;
}

export function CollaboratorPermissionsDialog({ 
  open, 
  onOpenChange, 
  collaborateur 
}: CollaboratorPermissionsDialogProps) {
  const { loading, fetchPermissions, savePermissions, getPermissionsMap } = useCollaboratorPermissions();
  const [permissionsState, setPermissionsState] = useState<Record<PermissionModule, PermissionUpdate>>({} as any);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (open && collaborateur) {
      setInitialized(false);
      fetchPermissions(collaborateur.id).then(() => {
        setInitialized(true);
      });
    }
  }, [open, collaborateur, fetchPermissions]);

  useEffect(() => {
    if (initialized) {
      setPermissionsState(getPermissionsMap());
    }
  }, [initialized]);

  const handleToggle = (module: PermissionModule, field: 'can_read' | 'can_create' | 'can_update' | 'can_delete') => {
    setPermissionsState(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [field]: !prev[module][field]
      }
    }));
  };

  const handleToggleAll = (module: PermissionModule) => {
    const current = permissionsState[module];
    const allEnabled = current.can_read && current.can_create && current.can_update && current.can_delete;
    
    setPermissionsState(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        can_read: !allEnabled,
        can_create: !allEnabled,
        can_update: !allEnabled,
        can_delete: !allEnabled
      }
    }));
  };

  const handleSave = async () => {
    if (!collaborateur) return;
    
    setSaving(true);
    const permissionUpdates = Object.values(permissionsState);
    const success = await savePermissions(collaborateur.id, permissionUpdates);
    setSaving(false);
    
    if (success) {
      onOpenChange(false);
    }
  };

  if (!collaborateur) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>Permissions de {collaborateur.first_name} {collaborateur.last_name}</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                Définissez les droits d'accès par module
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {(loading && !initialized) ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-[1fr,repeat(4,60px),40px] gap-2 px-3 py-2 bg-muted/50 rounded-lg text-xs font-medium text-muted-foreground">
              <span>Module</span>
              <span className="text-center flex flex-col items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                Lire
              </span>
              <span className="text-center flex flex-col items-center gap-1">
                <Plus className="h-3.5 w-3.5" />
                Créer
              </span>
              <span className="text-center flex flex-col items-center gap-1">
                <Pencil className="h-3.5 w-3.5" />
                Modifier
              </span>
              <span className="text-center flex flex-col items-center gap-1">
                <Trash2 className="h-3.5 w-3.5" />
                Suppr.
              </span>
              <span className="text-center text-[10px]">Tout</span>
            </div>

            {/* Permission rows */}
            {MODULES.map((module) => {
              const perms = permissionsState[module.value];
              if (!perms) return null;
              
              const allEnabled = perms.can_read && perms.can_create && perms.can_update && perms.can_delete;
              const someEnabled = perms.can_read || perms.can_create || perms.can_update || perms.can_delete;

              return (
                <div 
                  key={module.value}
                  className={cn(
                    "grid grid-cols-[1fr,repeat(4,60px),40px] gap-2 px-3 py-3 rounded-lg border transition-colors",
                    someEnabled ? "bg-primary/5 border-primary/20" : "bg-background border-border"
                  )}
                >
                  <Label className="font-medium flex items-center">
                    {module.label}
                  </Label>
                  
                  <div className="flex justify-center">
                    <Checkbox
                      checked={perms.can_read}
                      onCheckedChange={() => handleToggle(module.value, 'can_read')}
                    />
                  </div>
                  
                  <div className="flex justify-center">
                    <Checkbox
                      checked={perms.can_create}
                      onCheckedChange={() => handleToggle(module.value, 'can_create')}
                    />
                  </div>
                  
                  <div className="flex justify-center">
                    <Checkbox
                      checked={perms.can_update}
                      onCheckedChange={() => handleToggle(module.value, 'can_update')}
                    />
                  </div>
                  
                  <div className="flex justify-center">
                    <Checkbox
                      checked={perms.can_delete}
                      onCheckedChange={() => handleToggle(module.value, 'can_delete')}
                    />
                  </div>

                  <div className="flex justify-center">
                    <Checkbox
                      checked={allEnabled}
                      onCheckedChange={() => handleToggleAll(module.value)}
                      className={cn(
                        allEnabled && "bg-primary border-primary"
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
