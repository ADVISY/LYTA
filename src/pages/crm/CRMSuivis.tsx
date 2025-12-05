import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ClipboardList, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSuivis, suiviTypeLabels, suiviStatusLabels, suiviStatusColors, SuiviType, SuiviStatus } from "@/hooks/useSuivis";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const statsCards = [
  { key: "ouverts", label: "Ouverts", icon: Clock, color: "from-blue-500 to-indigo-600" },
  { key: "en_cours", label: "En cours", icon: AlertCircle, color: "from-amber-500 to-orange-600" },
  { key: "fermes", label: "Fermés", icon: CheckCircle2, color: "from-emerald-500 to-teal-600" },
  { key: "total", label: "Total", icon: Calendar, color: "from-violet-500 to-purple-600" },
];

export default function CRMSuivis() {
  const navigate = useNavigate();
  const { suivis, loading, stats, closeSuivi, reopenSuivi, deleteSuivi } = useSuivis();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const getClientName = (suivi: typeof suivis[0]) => {
    if (!suivi.client) return "—";
    if (suivi.client.company_name) return suivi.client.company_name;
    return `${suivi.client.first_name || ""} ${suivi.client.last_name || ""}`.trim() || "—";
  };

  const filteredSuivis = suivis.filter((suivi) => {
    const matchesSearch =
      searchQuery === "" ||
      suivi.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (suivi.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      getClientName(suivi).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || suivi.status === statusFilter;
    const matchesType = typeFilter === "all" || suivi.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-8">
      {/* Header with decorative background */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent rounded-3xl blur-2xl" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl blur-lg opacity-50" />
              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-xl">
                <ClipboardList className="h-7 w-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Suivis
              </h1>
              <p className="text-muted-foreground">Gérez vos suivis et tâches</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {statsCards.map((stat, index) => (
          <Card 
            key={stat.label} 
            className="group border-0 shadow-lg bg-card/80 backdrop-blur hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={cn(
              "absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-10 blur-2xl bg-gradient-to-br",
              stat.color
            )} />
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <CardContent className="p-5 relative">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "p-2.5 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
                  stat.color
                )}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold">{stats[stat.key as keyof typeof stats]}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre, description ou client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {(Object.keys(suiviStatusLabels) as SuiviStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {suiviStatusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {(Object.keys(suiviTypeLabels) as SuiviType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {suiviTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Suivis Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des suivis ({filteredSuivis.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredSuivis.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-2">
                {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                  ? "Aucun suivi ne correspond aux critères"
                  : "Aucun suivi enregistré"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date de rappel</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuivis.map((suivi) => (
                  <TableRow key={suivi.id}>
                    <TableCell className="font-medium">
                      {suivi.title}
                      {suivi.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {suivi.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        className="p-0 h-auto font-normal"
                        onClick={() => navigate(`/crm/clients/${suivi.client_id}?tab=suivis`)}
                      >
                        {getClientName(suivi)}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {suivi.type ? (
                        <Badge variant="outline">
                          {suiviTypeLabels[suivi.type] || suivi.type}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${suiviStatusColors[suivi.status]} text-white`}>
                        {suiviStatusLabels[suivi.status] || suivi.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {suivi.reminder_date ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(suivi.reminder_date), "dd/MM/yyyy", { locale: fr })}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(suivi.created_at), "dd/MM/yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/crm/clients/${suivi.client_id}?tab=suivis`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Voir le client
                          </DropdownMenuItem>
                          {suivi.status !== "ferme" ? (
                            <DropdownMenuItem onClick={() => closeSuivi(suivi.id)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Fermer le suivi
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => reopenSuivi(suivi.id)}>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Réouvrir
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => deleteSuivi(suivi.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
