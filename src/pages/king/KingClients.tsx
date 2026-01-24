import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Search, Users, Building2, Mail, Phone, Calendar, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  created_at: string;
  user_id: string | null;
  tenant_id: string | null;
  tenant?: {
    id: string;
    name: string;
  } | null;
}

export default function KingClients() {
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [clients, setClients] = useState<Client[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch tenants for filter
    const { data: tenantsData } = await supabase
      .from("tenants")
      .select("id, name")
      .order("name");
    
    if (tenantsData) {
      setTenants(tenantsData);
    }

    // Fetch clients with tenant info
    const { data: clientsData } = await supabase
      .from("clients")
      .select(`
        id,
        first_name,
        last_name,
        company_name,
        email,
        phone,
        mobile,
        created_at,
        user_id,
        tenant_id,
        tenant:tenants(id, name)
      `)
      .eq("type_adresse", "client")
      .order("created_at", { ascending: false });

    if (clientsData) {
      setClients(clientsData as Client[]);
    }
    
    setLoading(false);
  };

  const getClientName = (client: Client) => {
    if (client.company_name) return client.company_name;
    return `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Sans nom";
  };

  const getInitials = (client: Client) => {
    if (client.company_name) {
      return client.company_name.substring(0, 2).toUpperCase();
    }
    const first = client.first_name?.[0] || "";
    const last = client.last_name?.[0] || "";
    return (first + last).toUpperCase() || "?";
  };

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      search === "" ||
      getClientName(client).toLowerCase().includes(search.toLowerCase()) ||
      client.email?.toLowerCase().includes(search.toLowerCase()) ||
      client.phone?.includes(search) ||
      client.mobile?.includes(search);

    const matchesTenant =
      tenantFilter === "all" || client.tenant_id === tenantFilter;

    return matchesSearch && matchesTenant;
  });

  const clientsWithAccount = clients.filter((c) => c.user_id).length;
  const clientsWithoutAccount = clients.filter((c) => !c.user_id).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Clients</h1>
        <p className="text-muted-foreground">
          Vue d'ensemble des clients de tous les tenants
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clients.length}</p>
                <p className="text-sm text-muted-foreground">Total clients</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clientsWithAccount}</p>
                <p className="text-sm text-muted-foreground">Avec accès portail</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clientsWithoutAccount}</p>
                <p className="text-sm text-muted-foreground">Sans compte</p>
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
                placeholder="Rechercher un client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="w-full md:w-[250px]">
                <SelectValue placeholder="Tous les tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les tenants</SelectItem>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
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
            Liste des clients ({filteredClients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun client trouvé
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Accès portail</TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(client)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{getClientName(client)}</p>
                          {client.company_name && client.first_name && (
                            <p className="text-xs text-muted-foreground">
                              {client.first_name} {client.last_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.tenant ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{client.tenant.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {client.email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {client.email}
                          </div>
                        )}
                        {(client.phone || client.mobile) && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {client.mobile || client.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.user_id ? (
                        <Badge className="bg-emerald-500">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Non créé</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(client.created_at), "dd MMM yyyy", {
                          locale: fr,
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.tenant && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            navigate(`/king/tenants/${client.tenant_id}`)
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
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
