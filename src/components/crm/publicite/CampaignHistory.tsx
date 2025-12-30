import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { History, Search, Mail, MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";

interface ScheduledEmail {
  id: string;
  email_type: string;
  target_type: string;
  target_id: string;
  status: string;
  scheduled_for: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  welcome: "Bienvenue",
  contract_signed: "Contrat signé",
  mandat_signed: "Mandat signé",
  account_created: "Compte créé",
  renewal_reminder: "Rappel renouvellement",
  follow_up: "Suivi client",
  birthday: "Anniversaire",
  relation_client: "Relation client",
  offre_speciale: "Offre spéciale",
  sms: "SMS",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  pending: { label: "En attente", variant: "secondary", icon: Clock },
  sent: { label: "Envoyé", variant: "default", icon: CheckCircle },
  failed: { label: "Échoué", variant: "destructive", icon: XCircle },
  cancelled: { label: "Annulé", variant: "outline", icon: AlertCircle },
};

export const CampaignHistory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<"all" | "email" | "sms">("all");

  const { data: emails, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["scheduled-emails", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("scheduled_emails")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ScheduledEmail[];
    },
  });

  const filteredEmails = emails?.filter((email) => {
    // Channel filter
    if (channelFilter === "sms" && email.email_type !== "sms") return false;
    if (channelFilter === "email" && email.email_type === "sms") return false;
    
    // Search filter
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      email.email_type.toLowerCase().includes(search) ||
      email.target_type.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Historique des campagnes
              </CardTitle>
              <CardDescription>
                Consultez l'historique des emails et SMS envoyés
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={channelFilter} onValueChange={(v) => setChannelFilter(v as "all" | "email" | "sms")}>
              <TabsList>
                <TabsTrigger value="all">Tout</TabsTrigger>
                <TabsTrigger value="email" className="gap-1">
                  <Mail className="h-3 w-3" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="sms" className="gap-1">
                  <MessageSquare className="h-3 w-3" />
                  SMS
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="sent">Envoyé</SelectItem>
                <SelectItem value="failed">Échoué</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{filteredEmails?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10">
              <p className="text-2xl font-bold text-green-600">
                {filteredEmails?.filter((e) => e.status === "sent").length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Envoyés</p>
            </div>
            <div className="p-4 rounded-lg bg-yellow-500/10">
              <p className="text-2xl font-bold text-yellow-600">
                {filteredEmails?.filter((e) => e.status === "pending").length || 0}
              </p>
              <p className="text-sm text-muted-foreground">En attente</p>
            </div>
            <div className="p-4 rounded-lg bg-red-500/10">
              <p className="text-2xl font-bold text-red-600">
                {filteredEmails?.filter((e) => e.status === "failed").length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Échoués</p>
            </div>
          </div>

          {/* Table */}
          {filteredEmails && filteredEmails.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Programmé pour</TableHead>
                    <TableHead>Envoyé le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell>
                        <span className="font-medium">
                          {EMAIL_TYPE_LABELS[email.email_type] || email.email_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        {email.email_type === "sms" ? (
                          <Badge variant="outline" className="gap-1">
                            <MessageSquare className="h-3 w-3" />
                            SMS
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Mail className="h-3 w-3" />
                            Email
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(email.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(email.scheduled_for), "dd MMM yyyy HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {email.sent_at
                          ? format(new Date(email.sent_at), "dd MMM yyyy HH:mm", { locale: fr })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Aucun historique trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
