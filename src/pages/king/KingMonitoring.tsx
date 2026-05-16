/**
 * KingMonitoring — santé + vue cross-tenant
 * Tabs : Health (incidents/notifs) · Tous clients · Tous contrats
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Loader2, AlertTriangle, ExternalLink, Users, FileText, Search, Server } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const formatChf = (n: number | null) =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2 }).format(n);

function HealthTab() {
  const { data: health = [], isLoading } = useQuery({
    queryKey: ["king-health-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_health_summary");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const { data: recentErrors = [] } = useQuery({
    queryKey: ["king-recent-errors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("king_notifications")
        .select("id, title, message, kind, priority, tenant_name, action_url, created_at")
        .or("priority.eq.high,priority.eq.urgent")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-500" />
            Incidents par type (7 derniers jours)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : health.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-40 text-emerald-500" />
              <p className="font-medium text-emerald-700">Aucun incident des 7 derniers jours 🎉</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">24h</TableHead>
                  <TableHead className="text-right">7 jours</TableHead>
                  <TableHead>Dernier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {health.map((h: any) => (
                  <TableRow key={h.kind}>
                    <TableCell><Badge variant="outline">{h.kind}</Badge></TableCell>
                    <TableCell className="text-right font-bold">{Number(h.count_24h)}</TableCell>
                    <TableCell className="text-right">{Number(h.count_7d)}</TableCell>
                    <TableCell className="text-sm">{h.last_at ? formatDistanceToNow(new Date(h.last_at), { locale: fr, addSuffix: true }) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Derniers incidents critiques
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun incident critique récent.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentErrors.map((e: any) => (
                <Link
                  key={e.id}
                  to={e.action_url || "#"}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">{e.priority}</Badge>
                      <span className="font-medium text-sm">{e.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(e.created_at), { locale: fr, addSuffix: true })}
                    </span>
                  </div>
                  {e.message && <p className="text-xs text-muted-foreground">{e.message}</p>}
                  {e.tenant_name && <p className="text-xs text-primary mt-1">{e.tenant_name}</p>}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 flex items-center gap-3">
          <Server className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Logs détaillés edge functions</p>
            <p className="text-xs text-muted-foreground">Pour les erreurs, latences et stack traces complètes, ouvre le dashboard Supabase.</p>
          </div>
          <a
            href="https://supabase.com/dashboard/project/shxbcszukoegvvejcpsn/functions"
            target="_blank" rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Supabase Logs <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

function CrossTenantClientsTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["king-cross-tenant-clients", debouncedSearch],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_all_clients_cross_tenant", {
        p_search: debouncedSearch || null,
        p_tenant_id: null,
        p_limit: 200,
        p_offset: 0,
      });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Tous les clients de la plateforme
        </CardTitle>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher nom, email, téléphone, société..."
          className="mt-3 max-w-md"
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">{rows.length} résultat(s)</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "—"}
                    </TableCell>
                    <TableCell>
                      <Link to={`/king/tenants/${c.tenant_id}`} className="text-primary hover:underline text-sm">
                        {c.tenant_name || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{c.email || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{c.type_adresse || "client"}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{c.status || "—"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CrossTenantPoliciesTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useState(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["king-cross-tenant-policies", debouncedSearch],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_all_policies_cross_tenant", {
        p_search: debouncedSearch || null,
        p_tenant_id: null,
        p_limit: 200,
        p_offset: 0,
      });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-violet-500" />
          Tous les contrats de la plateforme
        </CardTitle>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher numéro police, client..."
          className="mt-3 max-w-md"
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">{rows.length} résultat(s)</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Police</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Prime</TableHead>
                  <TableHead>Signature</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.policy_number || "—"}</TableCell>
                    <TableCell className="text-sm">{p.client_name || "—"}</TableCell>
                    <TableCell>
                      <Link to={`/king/tenants/${p.tenant_id}`} className="text-primary hover:underline text-sm">
                        {p.tenant_name || "—"}
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant="outline">{p.category || "—"}</Badge></TableCell>
                    <TableCell className="text-right">{formatChf(Number(p.premium_amount))}</TableCell>
                    <TableCell><Badge variant="outline">{p.signature_status || "—"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function KingMonitoring() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Activity className="h-7 w-7 text-emerald-500" />
          Monitoring & vue plateforme
        </h1>
        <p className="text-muted-foreground">Santé des intégrations + vue cross-tenant globale.</p>
      </div>

      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health" className="gap-2"><Activity className="h-4 w-4" />Santé</TabsTrigger>
          <TabsTrigger value="clients" className="gap-2"><Users className="h-4 w-4" />Tous les clients</TabsTrigger>
          <TabsTrigger value="policies" className="gap-2"><FileText className="h-4 w-4" />Tous les contrats</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="mt-6"><HealthTab /></TabsContent>
        <TabsContent value="clients" className="mt-6"><CrossTenantClientsTab /></TabsContent>
        <TabsContent value="policies" className="mt-6"><CrossTenantPoliciesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
