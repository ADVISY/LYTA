import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useClients } from "@/hooks/useClients";
import { usePendingScans } from "@/hooks/usePendingScans";
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
import { Plus, Eye, Edit, Trash2, Search, Users, Building2, Briefcase, UserCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/crm/UserAvatar";
import { useTranslation } from "react-i18next";


export default function ClientsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clients, loading, deleteClient, fetchClients } = useClients();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("client");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    prospect: { label: t('clients.prospect'), color: "text-blue-700", bgColor: "bg-blue-100" },
    actif: { label: t('clients.active'), color: "text-emerald-700", bgColor: "bg-emerald-100" },
    résilié: { label: t('clients.terminated'), color: "text-slate-700", bgColor: "bg-slate-100" },
    dormant: { label: t('clients.dormant'), color: "text-amber-700", bgColor: "bg-amber-100" },
  };

  const { scans: pendingScans } = usePendingScans();
  const pendingScanCount = pendingScans.filter(s => s.status === 'completed' || s.status === 'processing').length;

  const typeConfig = [
    { value: "client", label: t('clients.clients'), icon: Users, color: "from-blue-500 to-blue-600" },
    { value: "collaborateur", label: t('collaborators.title'), icon: Briefcase, color: "from-emerald-500 to-emerald-600" },
    { value: "partenaire", label: t('clients.partners'), icon: Building2, color: "from-violet-500 to-purple-600" },
    { value: "ia-scan", label: "Dépôts IA", icon: Sparkles, color: "from-cyan-500 to-blue-600", badge: pendingScanCount },
  ];

  useEffect(() => {
    if (typeFilter !== 'ia-scan') {
      fetchClients(typeFilter);
    }
  }, [typeFilter]);

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      !searchTerm ||
      client.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.company_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || client.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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
              {filteredClients.length} {currentType.label.toLowerCase()}
            </p>
          </div>
        </div>
        <Button 
          onClick={() => navigate("/crm/clients/nouveau")}
          className="group bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
          {t('clients.newAddress')}
        </Button>
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
            {type.badge && type.badge > 0 && (
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
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
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
              <SelectTrigger className="w-full sm:w-[200px] h-11 bg-muted/50 border-0">
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
                        {client.city || "—"}
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
