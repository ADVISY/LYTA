import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Shield, Plus, Pencil, Trash2, Copy, Users, Eye, EyeOff,
  Check, X, Loader2, RefreshCw, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  useTenantRoles, 
  useRolePermissions,
  TenantRole,
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  MODULE_ACTIONS
} from "@/hooks/useTenantRoles";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RolesManagerProps {
  onInitializeRoles?: () => void;
}

export function RolesManager({ onInitializeRoles }: RolesManagerProps) {
  const { roles, isLoading, createRole, updateRole, deleteRole, duplicateRole, initializeDefaultRoles, refresh } = useTenantRoles();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dashboard_scope: 'personal' as 'personal' | 'team' | 'global',
    can_see_own_commissions: true,
    can_see_team_commissions: false,
    can_see_all_commissions: false,
  });
  const [duplicateName, setDuplicateName] = useState('');

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  const handleCreate = async () => {
    const result = await createRole(formData);
    if (!result.error) {
      setIsCreating(false);
      resetForm();
      if (result.data) {
        setSelectedRoleId(result.data.id);
      }
    }
  };

  const handleUpdate = async () => {
    if (!selectedRoleId) return;
    const result = await updateRole(selectedRoleId, formData);
    if (!result.error) {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRoleId || !selectedRole) return;
    if (selectedRole.is_system_role) {
      return;
    }
    const confirmed = window.confirm(`Supprimer le rôle "${selectedRole.name}" ?`);
    if (confirmed) {
      const result = await deleteRole(selectedRoleId);
      if (!result.error) {
        setSelectedRoleId(null);
      }
    }
  };

  const handleDuplicate = async () => {
    if (!selectedRoleId || !duplicateName.trim()) return;
    const result = await duplicateRole(selectedRoleId, duplicateName);
    if (!result.error && result.data) {
      setIsDuplicating(false);
      setDuplicateName('');
      setSelectedRoleId(result.data.id);
    }
  };

  const handleInitializeRoles = async () => {
    await initializeDefaultRoles();
    onInitializeRoles?.();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      dashboard_scope: 'personal',
      can_see_own_commissions: true,
      can_see_team_commissions: false,
      can_see_all_commissions: false,
    });
  };

  const startEditing = () => {
    if (!selectedRole) return;
    setFormData({
      name: selectedRole.name,
      description: selectedRole.description || '',
      dashboard_scope: selectedRole.dashboard_scope,
      can_see_own_commissions: selectedRole.can_see_own_commissions,
      can_see_team_commissions: selectedRole.can_see_team_commissions,
      can_see_all_commissions: selectedRole.can_see_all_commissions,
    });
    setIsEditing(true);
  };

  const startDuplicating = () => {
    if (!selectedRole) return;
    setDuplicateName(`${selectedRole.name} (copie)`);
    setIsDuplicating(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucun rôle configuré</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Initialisez les rôles par défaut pour commencer à gérer les permissions de votre cabinet.
          </p>
          <Button onClick={handleInitializeRoles} className="gap-2">
            <Plus className="h-4 w-4" />
            Créer les rôles par défaut
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestion des rôles
          </h3>
          <p className="text-sm text-muted-foreground">
            Définissez les rôles et permissions pour votre cabinet
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau rôle
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rôles ({roles.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-1 p-4 pt-0">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                      selectedRoleId === role.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4" />
                      <div>
                        <p className="font-medium text-sm">{role.name}</p>
                        {role.is_system_role && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Système
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!role.is_active && (
                      <Badge variant="outline" className="text-xs">
                        Inactif
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Role Details & Permissions */}
        <Card className="lg:col-span-2">
          {selectedRole ? (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {selectedRole.name}
                      {selectedRole.is_system_role && (
                        <Badge variant="secondary">Système</Badge>
                      )}
                    </CardTitle>
                    {selectedRole.description && (
                      <CardDescription>{selectedRole.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={startDuplicating}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={startEditing}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!selectedRole.is_system_role && (
                      <Button variant="destructive" size="sm" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="permissions">
                  <TabsList className="mb-4">
                    <TabsTrigger value="permissions">Permissions</TabsTrigger>
                    <TabsTrigger value="visibility">Visibilité</TabsTrigger>
                  </TabsList>

                  <TabsContent value="permissions">
                    <PermissionsMatrix roleId={selectedRole.id} />
                  </TabsContent>

                  <TabsContent value="visibility">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg border">
                          <Label className="text-sm font-medium">Scope Dashboard</Label>
                          <p className="text-2xl font-bold capitalize mt-1">
                            {selectedRole.dashboard_scope === 'personal' ? 'Personnel' :
                             selectedRole.dashboard_scope === 'team' ? 'Équipe' : 'Global'}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg border">
                          <Label className="text-sm font-medium">Statut</Label>
                          <p className="text-2xl font-bold mt-1">
                            {selectedRole.is_active ? 'Actif' : 'Inactif'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="p-4 rounded-lg border space-y-3">
                        <Label className="text-sm font-medium">Visibilité Commissions</Label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {selectedRole.can_see_own_commissions ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm">Ses propres commissions</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedRole.can_see_team_commissions ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm">Commissions de son équipe</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedRole.can_see_all_commissions ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm">Toutes les commissions</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-20">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Sélectionnez un rôle pour voir ses permissions</p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Create Role Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer un nouveau rôle</DialogTitle>
          </DialogHeader>
          <RoleForm formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>Annuler</Button>
            <Button onClick={handleCreate}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
          </DialogHeader>
          <RoleForm formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>Annuler</Button>
            <Button onClick={handleUpdate}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Role Dialog */}
      <Dialog open={isDuplicating} onOpenChange={setIsDuplicating}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dupliquer le rôle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom du nouveau rôle</Label>
              <Input
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="Nom du rôle"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDuplicating(false)}>Annuler</Button>
            <Button onClick={handleDuplicate}>Dupliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Role Form Component
interface RoleFormData {
  name: string;
  description: string;
  dashboard_scope: 'personal' | 'team' | 'global';
  can_see_own_commissions: boolean;
  can_see_team_commissions: boolean;
  can_see_all_commissions: boolean;
}

interface RoleFormProps {
  formData: RoleFormData;
  setFormData: React.Dispatch<React.SetStateAction<RoleFormData>>;
}

function RoleForm({ formData, setFormData }: RoleFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Nom du rôle</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
          placeholder="Ex: Commercial Senior"
        />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
          placeholder="Description du rôle..."
          rows={2}
        />
      </div>
      <div>
        <Label>Scope Dashboard</Label>
        <Select
          value={formData.dashboard_scope}
          onValueChange={(v) => setFormData(f => ({ ...f, dashboard_scope: v as any }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="personal">Personnel (ses données uniquement)</SelectItem>
            <SelectItem value="team">Équipe (son équipe)</SelectItem>
            <SelectItem value="global">Global (tout le cabinet)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-3">
        <Label>Visibilité Commissions</Label>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Voir ses commissions</span>
            <Switch
              checked={formData.can_see_own_commissions}
              onCheckedChange={(c) => setFormData(f => ({ ...f, can_see_own_commissions: c }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Voir commissions équipe</span>
            <Switch
              checked={formData.can_see_team_commissions}
              onCheckedChange={(c) => setFormData(f => ({ ...f, can_see_team_commissions: c }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Voir toutes les commissions</span>
            <Switch
              checked={formData.can_see_all_commissions}
              onCheckedChange={(c) => setFormData(f => ({ ...f, can_see_all_commissions: c }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Permissions Matrix Component
function PermissionsMatrix({ roleId }: { roleId: string }) {
  const { permissions, isLoading, setPermission, hasPermission } = useRolePermissions(roleId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getActionLabel = (actionId: string) => {
    return PERMISSION_ACTIONS.find(a => a.id === actionId)?.label || actionId;
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4">
        {PERMISSION_MODULES.map((module) => {
          const moduleActions = MODULE_ACTIONS[module.id] || [];
          
          return (
            <div key={module.id} className="border rounded-lg p-4">
              <h4 className="font-medium mb-3">{module.label}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {moduleActions.map((action) => {
                  const isAllowed = hasPermission(module.id, action);
                  
                  return (
                    <label
                      key={`${module.id}-${action}`}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm",
                        isAllowed ? "bg-primary/10" : "hover:bg-muted"
                      )}
                    >
                      <Checkbox
                        checked={isAllowed}
                        onCheckedChange={(checked) => {
                          setPermission(module.id, action, !!checked);
                        }}
                      />
                      <span className={cn(isAllowed && "font-medium")}>
                        {getActionLabel(action)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default RolesManager;
