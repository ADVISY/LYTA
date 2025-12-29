import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, Plus, Trash2, Shield, Loader2, RefreshCw, UserPlus, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenantRoles, useUserRoleAssignments } from "@/hooks/useTenantRoles";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export function UserRolesManager() {
  const { tenantId } = useTenant();
  const { roles, isLoading: rolesLoading } = useTenantRoles();
  const { assignments, isLoading: assignmentsLoading, assignRole, removeAssignment, refresh } = useUserRoleAssignments();
  
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Load users from profiles that belong to this tenant
  useEffect(() => {
    const loadUsers = async () => {
      if (!tenantId) return;

      try {
        // Get user IDs assigned to this tenant
        const { data: tenantUsers, error: tenantError } = await supabase
          .from('user_tenant_assignments')
          .select('user_id')
          .eq('tenant_id', tenantId);

        if (tenantError) throw tenantError;

        if (!tenantUsers || tenantUsers.length === 0) {
          setUsers([]);
          setUsersLoading(false);
          return;
        }

        const userIds = tenantUsers.map(tu => tu.user_id);

        // Get profiles for these users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .in('id', userIds)
          .order('last_name');

        if (profilesError) throw profilesError;

        setUsers(profiles || []);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setUsersLoading(false);
      }
    };

    loadUsers();
  }, [tenantId]);

  const handleAssignRole = async () => {
    if (!selectedUserId || !selectedRoleId) {
      toast.error('Veuillez sélectionner un utilisateur et un rôle');
      return;
    }

    const result = await assignRole(selectedUserId, selectedRoleId);
    if (!result.error) {
      setIsAssigning(false);
      setSelectedUserId('');
      setSelectedRoleId('');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    const confirmed = window.confirm('Retirer ce rôle de l\'utilisateur ?');
    if (confirmed) {
      await removeAssignment(assignmentId);
    }
  };

  const getUserName = (user: User) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.email;
  };

  const getUserInitials = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  const getUserRoles = (userId: string) => {
    return assignments.filter(a => a.user_id === userId);
  };

  const filteredUsers = users.filter(user => {
    const name = getUserName(user).toLowerCase();
    const email = user.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  const isLoading = rolesLoading || assignmentsLoading || usersLoading;

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
          <p className="text-muted-foreground text-center mb-6">
            Créez d'abord des rôles dans l'onglet "Rôles" avant d'assigner des utilisateurs.
          </p>
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
            <Users className="h-5 w-5" />
            Attribution des rôles
          </h3>
          <p className="text-sm text-muted-foreground">
            Assignez des rôles aux utilisateurs de votre cabinet
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setIsAssigning(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Assigner un rôle
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un utilisateur..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users List */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôles</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur dans ce cabinet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const userRoles = getUserRoles(user.id);
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getUserInitials(user)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{getUserName(user)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {userRoles.length === 0 ? (
                              <span className="text-muted-foreground text-sm">Aucun rôle</span>
                            ) : (
                              userRoles.map((assignment) => (
                                <Badge
                                  key={assignment.id}
                                  variant="secondary"
                                  className="flex items-center gap-1"
                                >
                                  {assignment.tenant_roles?.name || 'Rôle inconnu'}
                                  <button
                                    onClick={() => handleRemoveAssignment(assignment.id)}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setIsAssigning(true);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Assign Role Dialog */}
      <Dialog open={isAssigning} onOpenChange={setIsAssigning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assigner un rôle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Utilisateur</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {getUserName(user)} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Rôle</label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {roles.filter(r => r.is_active).map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                      {role.description && (
                        <span className="text-muted-foreground ml-2">
                          — {role.description}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssigning(false)}>
              Annuler
            </Button>
            <Button onClick={handleAssignRole}>
              Assigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UserRolesManager;
