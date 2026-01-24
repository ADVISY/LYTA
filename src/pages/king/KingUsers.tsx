import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Users, Crown, Shield, Building2, Mail, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PlatformUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  roles: string[];
  tenants: { id: string; name: string }[];
}

const roleConfig: Record<string, { label: string; color: string; icon: any }> = {
  king: { label: "Super Admin", color: "bg-amber-500", icon: Crown },
  admin: { label: "Admin", color: "bg-purple-500", icon: Shield },
  agent: { label: "Agent", color: "bg-blue-500", icon: Users },
  manager: { label: "Manager", color: "bg-emerald-500", icon: Users },
  partner: { label: "Partenaire", color: "bg-cyan-500", icon: Users },
};

export default function KingUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);

    // Get all users with non-client roles
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .neq("role", "client");

    if (!userRoles || userRoles.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(userRoles.map((ur) => ur.user_id))];

    // Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, created_at")
      .in("id", userIds);

    // Fetch tenant assignments
    const { data: tenantAssignments } = await supabase
      .from("user_tenant_assignments")
      .select("user_id, tenant:tenants(id, name)")
      .in("user_id", userIds);

    // Build user objects
    const usersMap = new Map<string, PlatformUser>();

    profiles?.forEach((profile) => {
      usersMap.set(profile.id, {
        id: profile.id,
        email: profile.email || "",
        first_name: profile.first_name,
        last_name: profile.last_name,
        created_at: profile.created_at,
        roles: [],
        tenants: [],
      });
    });

    userRoles.forEach((ur) => {
      const user = usersMap.get(ur.user_id);
      if (user && !user.roles.includes(ur.role)) {
        user.roles.push(ur.role);
      }
    });

    tenantAssignments?.forEach((ta) => {
      const user = usersMap.get(ta.user_id);
      if (user && ta.tenant) {
        const tenant = ta.tenant as { id: string; name: string };
        if (!user.tenants.find((t) => t.id === tenant.id)) {
          user.tenants.push(tenant);
        }
      }
    });

    setUsers(Array.from(usersMap.values()));
    setLoading(false);
  };

  const getUserName = (user: PlatformUser) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ""} ${user.last_name || ""}`.trim();
    }
    return user.email;
  };

  const getInitials = (user: PlatformUser) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      search === "" ||
      getUserName(user).toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      roleFilter === "all" || user.roles.includes(roleFilter);

    return matchesSearch && matchesRole;
  });

  const kingCount = users.filter((u) => u.roles.includes("king")).length;
  const adminCount = users.filter((u) => u.roles.includes("admin")).length;
  const otherCount = users.filter(
    (u) => !u.roles.includes("king") && !u.roles.includes("admin")
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Utilisateurs Plateforme</h1>
        <p className="text-muted-foreground">
          Gérez les accès administrateurs et collaborateurs
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Crown className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kingCount}</p>
                <p className="text-sm text-muted-foreground">Super Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{adminCount}</p>
                <p className="text-sm text-muted-foreground">Admins Tenants</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{otherCount}</p>
                <p className="text-sm text-muted-foreground">Collaborateurs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un utilisateur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Tous les rôles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="king">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="partner">Partenaire</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Utilisateurs ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun utilisateur trouvé
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Rôles</TableHead>
                  <TableHead>Tenants</TableHead>
                  <TableHead>Inscrit le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback
                            className={`${
                              user.roles.includes("king")
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-primary/10 text-primary"
                            } text-sm`}
                          >
                            {getInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{getUserName(user)}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => {
                          const config = roleConfig[role] || {
                            label: role,
                            color: "bg-gray-500",
                          };
                          return (
                            <Badge
                              key={role}
                              className={`${config.color} text-white`}
                            >
                              {config.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.tenants.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.tenants.map((tenant) => (
                            <Badge
                              key={tenant.id}
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              <Building2 className="h-3 w-3" />
                              {tenant.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(user.created_at), "dd MMM yyyy", {
                          locale: fr,
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
