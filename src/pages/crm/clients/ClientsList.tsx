import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useClients } from "@/hooks/useClients";
import { usePendingScanCount } from "@/hooks/usePendingScans";
import { DataPagination } from "@/components/ui/DataPagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Eye, Edit, Trash2, Search, Users, Building2, Briefcase, UserCircle, Sparkles, AlertTriangle, RefreshCw, Upload, MessageCircle, Phone } from "lucide-react";
import { QuickContactDialog, type QuickContactMode } from "@/components/crm/clients/QuickContactDialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/crm/UserAvatar";
import { useTranslation } from "react-i18next";
import { ProspectImportDialog } from "@/components/crm/clients/ProspectImportDialog";


export default function ClientsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("client");
  // Filtres géographiques (Romandie + tous cantons CH)
  const [cantonFilter, setCantonFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [debouncedCity, setDebouncedCity] = useState<string>("");
  const [postalCodeFilter, setPostalCodeFilter] = useState<string>("");
  const [debouncedPostalCode, setDebouncedPostalCode] = useState<string>("");
  // Filtre Pro / Privé : "all" = pas de filtre, "pro" = is_company=true, "prive" = is_company=false/null
  const [companyTypeFilter, setCompanyTypeFilter] = useState<"all" | "pro" | "prive">("all");

  // Debounce 300ms : évite de spammer Supabase à chaque frappe clavier
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCity(cityFilter.trim()), 300);
    return () => clearTimeout(t);
  }, [cityFilter]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPostalCode(postalCodeFilter.trim()), 300);
    return () => clearTimeout(t);
  }, [postalCodeFilter]);

  const {
    clients,
    loading,
    isError,
    error,
    fetchClients,
    deleteClient,
    page,
    totalCount,
    totalPages,
    goToPage,
  } = useClients(typeFilter, debouncedSearch, {
    city: debouncedCity || null,
    canton: cantonFilter !== "all" ? cantonFilter : null,
    status: statusFilter !== "all" ? statusFilter : null,
    postalCode: debouncedPostalCode || null,
    isCompany: companyTypeFilter === "pro" ? true : companyTypeFilter === "prive" ? false : null,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  // Quick contact (WhatsApp / 3CX) dialog
  const [quickContactOpen, setQuickContactOpen] = useState(false);
  const [quickContactMode, setQuickContactMode] = useState<QuickContactMode>("whatsapp");
  const [quickContactClient, setQuickContactClient] = useState<any>(null);

  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    prospect: { label: t('clients.prospect'), color: "text-blue-700", bgColor: "bg-blue-100" },
    actif: { label: t('clients.active'), color: "text-emerald-700", bgColor: "bg-emerald-100" },
    résilié: { label: t('clients.terminated'), color: "text-slate-700", bgColor: "bg-slate-100" },
    dormant: { label: t('clients.dormant'), color: "text-amber-700", bgColor: "bg-amber-100" },
  };

  const { count: pendingScanCount } = usePendingScanCount();

  const typeConfig = [
    { value: "client", label: t('clients.clients'), icon: Users, color: "from-blue-500 to-blue-600" },
    { value: "collaborateur", label: t('collaborators.title'), icon: Briefcase, color: "from-emerald-500 to-emerald-600" },
    { value: "partenaire", label: t('clients.partners'), icon: Building2, color: "from-violet-500 to-purple-600" },
    { value: "ia-scan", label: t('propositions.smartflow', 'Smartflow'), icon: Sparkles, color: "from-cyan-500 to-blue-600", badge: pendingScanCount },
  ];

  // Recherche + tous les filtres (statut, canton, ville, NPA) sont maintenant
  // gérés côté serveur dans useClients via les paramètres RPC. Pas de filtre
  // local — sinon la pagination casse (le serveur renvoie 50 lignes filtrées,
  // un filtre local au-dessus retirerait des lignes et "perdrait" des résultats).
  const filteredClients = clients;
  const hasActiveFilters =
    statusFilter !== "all"
    || cantonFilter !== "all"
    || companyTypeFilter !== "all"
    || debouncedCity.length > 0
    || debouncedPostalCode.length > 0
    || debouncedSearch.length > 0;

  const handleDelete = async () => {
    if (clientToDelete) {
      await deleteClient(clientToDelete);
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const getClientName = (client: any) => {
    if (client.company_name) return client.company_name;
    if (client.first_name || client.last_name) {
      return `${client.first_name || ""} ${client.last_name || ""}`.trim();
    }
    return client.profile?.first_name && client.profile?.last_name
      ? `${client.profile.first_name} ${client.profile.last_name}`
      : t('common.noName');
  };

  const currentType = typeConfig.find(t => t.value === typeFilter) || typeConfig[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary" />
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur">
        <CardContent className="py-16">
          <div className="mx-auto flex max-w-lg flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold">{t('common.error')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error || "Impossible de charger les adresses pour le moment."}
            </p>
            <Button className="mt-6" onClick={() => fetchClients()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('common.retry', 'Réessayer')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-3 rounded-xl bg-gradient-to-br shadow-lg", currentType.color)}>
            <currentType.icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('clients.addresses')}</h1>
            <p className="text-muted-foreground">
              {totalCount} {currentType.label.toLowerCase()}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {typeFilter === "client" && (
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
              className="border-primary/30 hover:bg-primary/5 hover:border-primary/50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importer
            </Button>
          )}
          <Button
            onClick={() => navigate("/crm/clients/nouveau")}
            className="group bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
            {t('clients.newAddress')}
          </Button>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="flex gap-2 p-1 bg-muted/50 rounded-xl w-fit flex-wrap">
        {typeConfig.map((type) => (
          <Button
            key={type.value}
            variant="ghost"
            onClick={() => {
              if (type.value === 'ia-scan') {
                navigate('/crm/propositions');
              } else {
                setTypeFilter(type.value);
              }
            }}
            className={cn(
              "rounded-lg transition-all duration-300 relative",
              typeFilter === type.value
                ? "bg-card shadow-md text-foreground"
                : "hover:bg-card/50 text-muted-foreground"
            )}
          >
            <type.icon className="h-4 w-4 mr-2" />
            {type.label}
            {(type.badge ?? 0) > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center text-xs px-1.5"
              >
                {type.badge}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Search & Filters */}
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur">
        <CardContent className="p-4 space-y-3">
          {/* Ligne 1 : Recherche libre + Statut */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 h-11 bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-11 bg-muted/50 border-0">
                <SelectValue placeholder={t('common.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.allStatuses')}</SelectItem>
                <SelectItem value="prospect">{t('clients.prospect')}</SelectItem>
                <SelectItem value="actif">{t('clients.active')}</SelectItem>
                <SelectItem value="résilié">{t('clients.terminated')}</SelectItem>
                <SelectItem value="dormant">{t('clients.dormant')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ligne 2 : Filtres géographiques (canton + ville + NPA) */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={cantonFilter} onValueChange={setCantonFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-11 bg-muted/50 border-0">
                <SelectValue placeholder="Canton" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les cantons</SelectItem>
                {/* 26 cantons suisses + abréviations */}
                <SelectItem value="VD">Vaud (VD)</SelectItem>
                <SelectItem value="GE">Genève (GE)</SelectItem>
                <SelectItem value="VS">Valais (VS)</SelectItem>
                <SelectItem value="FR">Fribourg (FR)</SelectItem>
                <SelectItem value="NE">Neuchâtel (NE)</SelectItem>
                <SelectItem value="JU">Jura (JU)</SelectItem>
                <SelectItem value="BE">Berne (BE)</SelectItem>
                <SelectItem value="ZH">Zürich (ZH)</SelectItem>
                <SelectItem value="LU">Lucerne (LU)</SelectItem>
                <SelectItem value="UR">Uri (UR)</SelectItem>
                <SelectItem value="SZ">Schwyz (SZ)</SelectItem>
                <SelectItem value="OW">Obwald (OW)</SelectItem>
                <SelectItem value="NW">Nidwald (NW)</SelectItem>
                <SelectItem value="GL">Glaris (GL)</SelectItem>
                <SelectItem value="ZG">Zoug (ZG)</SelectItem>
                <SelectItem value="SO">Soleure (SO)</SelectItem>
                <SelectItem value="BS">Bâle-Ville (BS)</SelectItem>
                <SelectItem value="BL">Bâle-Campagne (BL)</SelectItem>
                <SelectItem value="SH">Schaffhouse (SH)</SelectItem>
                <SelectItem value="AR">Appenzell Rhodes-Extérieures (AR)</SelectItem>
                <SelectItem value="AI">Appenzell Rhodes-Intérieures (AI)</SelectItem>
                <SelectItem value="SG">Saint-Gall (SG)</SelectItem>
                <SelectItem value="GR">Grisons (GR)</SelectItem>
                <SelectItem value="AG">Argovie (AG)</SelectItem>
                <SelectItem value="TG">Thurgovie (TG)</SelectItem>
                <SelectItem value="TI">Tessin (TI)</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Ville (ex: Lausanne, Genève...)"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="flex-1 h-11 bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            <Input
              placeholder="NPA (ex: 1000, 12...)"
              value={postalCodeFilter}
              onChange={(e) => setPostalCodeFilter(e.target.value)}
              className="w-full sm:w-[160px] h-11 bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setCantonFilter("all");
                  setCityFilter("");
                  setPostalCodeFilter("");
                  setCompanyTypeFilter("all");
                }}
                className="h-11"
              >
                Réinitialiser
              </Button>
            )}
          </div>

          {/* Ligne 3 : Toggle Pro / Privé / Tous */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">Type :</span>
            {(
              [
                { value: "all", label: "Tous", color: "bg-muted text-foreground" },
                { value: "prive", label: "Privés", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
                { value: "pro", label: "Pro", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" },
              ] as const
            ).map((opt) => {
              const isActive = companyTypeFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCompanyTypeFilter(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : `${opt.color} border-transparent hover:border-border`
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">{t('clients.nameCompany')}</TableHead>
                <TableHead className="font-semibold">{t('common.email')}</TableHead>
                <TableHead className="font-semibold">{t('clients.city')}</TableHead>
                <TableHead className="font-semibold">{t('common.status')}</TableHead>
                <TableHead className="font-semibold">{t('clients.assignedAgent')}</TableHead>
                <TableHead className="text-right font-semibold">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <UserCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
                    <p className="text-lg font-medium text-muted-foreground">{t('common.noResults')}</p>
                    <p className="text-sm text-muted-foreground">{t('common.tryFilters')}</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client, index) => {
                  const status = statusConfig[client.status || 'prospect'];
                  return (
                    <TableRow
                      key={client.id}
                      className="group cursor-pointer hover:bg-muted/50 transition-all duration-200"
                      onClick={() => navigate(`/crm/clients/${client.id}`)}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            firstName={client.first_name}
                            lastName={client.last_name}
                            gender={(client as any).gender}
                            size="md"
                          />
                          <span className="font-medium group-hover:text-primary transition-colors">
                            {getClientName(client)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.email || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {(() => {
                          // Adresse complète : rue + NPA + ville. Affichée
                          // sur 2 lignes pour rester lisible. Fallback "—"
                          // si tout est vide.
                          const street = (client as any).address as string | null;
                          const npa = ((client as any).postal_code || (client as any).zip_code) as string | null;
                          const city = client.city;
                          const line2 = [npa, city].filter(Boolean).join(" ");
                          if (!street && !line2) return "—";
                          return (
                            <div className="leading-tight">
                              {street && <div className="text-foreground/90 text-sm">{street}</div>}
                              {line2 && <div className="text-xs">{line2}</div>}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {client.status && (
                          <Badge className={cn("font-medium", status?.bgColor, status?.color)}>
                            {status?.label || client.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.assigned_agent
                          ? `${client.assigned_agent.first_name || ""} ${client.assigned_agent.last_name || ""}`.trim() || client.assigned_agent.email
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          {/* WhatsApp quick contact */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-30"
                            disabled={!client.phone && !client.mobile}
                            title={(!client.phone && !client.mobile) ? "Aucun numéro renseigné" : "WhatsApp"}
                            onClick={() => {
                              setQuickContactClient(client);
                              setQuickContactMode("whatsapp");
                              setQuickContactOpen(true);
                            }}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {/* 3CX appel */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-30"
                            disabled={!client.phone && !client.mobile}
                            title={(!client.phone && !client.mobile) ? "Aucun numéro renseigné" : "Appel 3CX"}
                            onClick={() => {
                              setQuickContactClient(client);
                              setQuickContactMode("3cx");
                              setQuickContactOpen(true);
                            }}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                            onClick={() => navigate(`/crm/clients/${client.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                            onClick={() => navigate(`/crm/clients/${client.id}/edit`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                              setClientToDelete(client.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DataPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={goToPage}
      />

      <ProspectImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImported={() => fetchClients()}
      />

      <QuickContactDialog
        open={quickContactOpen}
        onOpenChange={setQuickContactOpen}
        mode={quickContactMode}
        client={quickContactClient}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-0 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('clients.deleteAddress')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('clients.deleteAddressConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
