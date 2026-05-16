import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Plus,
  Search,
  Building2,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  Eye,
  Edit,
  Trash2,
  Filter,
} from "lucide-react";
import { useAffiliates, useAffiliateStats, Affiliate } from "@/hooks/useAffiliates";
import { DataPagination } from "@/components/ui/DataPagination";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function KingAffiliates() {
  const navigate = useNavigate();
  const { affiliates, loading, createAffiliate, updateAffiliate, deleteAffiliate, page, totalPages, totalCount, goToPage } = useAffiliates();
  const { stats, affiliatesWithStats, loading: statsLoading } = useAffiliateStats();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    status: "active" as string,
    commission_rate: 10,
    ref_code: "",
    default_eligibility_months: 12,
    notes: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CH', { 
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(amount) + ' CHF';
  };

  const filteredAffiliates = affiliatesWithStats.filter(affiliate => {
    const matchesSearch = 
      affiliate.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      affiliate.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      affiliate.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || affiliate.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      status: "active",
      commission_rate: 10,
      ref_code: "",
      default_eligibility_months: 12,
      notes: ""
    });
  };

  const handleCreate = async () => {
    if (!formData.first_name || !formData.last_name || !formData.email) return;
    
    setIsSubmitting(true);
    try {
      await createAffiliate({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        status: formData.status,
        commission_rate: formData.commission_rate,
        ref_code: formData.ref_code.trim() || null,
        default_eligibility_months: formData.default_eligibility_months,
        notes: formData.notes || null
      } as any);
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedAffiliate) return;
    
    setIsSubmitting(true);
    try {
      await updateAffiliate(selectedAffiliate.id, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        status: formData.status,
        commission_rate: formData.commission_rate,
        ref_code: formData.ref_code.trim() || null,
        default_eligibility_months: formData.default_eligibility_months,
        notes: formData.notes || null
      } as any);
      setIsEditDialogOpen(false);
      setSelectedAffiliate(null);
      resetForm();
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAffiliate) return;
    
    setIsSubmitting(true);
    try {
      await deleteAffiliate(selectedAffiliate.id);
      setIsDeleteDialogOpen(false);
      setSelectedAffiliate(null);
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (affiliate: Affiliate) => {
    setSelectedAffiliate(affiliate);
    setFormData({
      first_name: affiliate.first_name,
      last_name: affiliate.last_name,
      email: affiliate.email,
      status: affiliate.status,
      commission_rate: affiliate.commission_rate,
      ref_code: affiliate.ref_code || "",
      default_eligibility_months: affiliate.default_eligibility_months ?? 12,
      notes: affiliate.notes || ""
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (affiliate: Affiliate) => {
    setSelectedAffiliate(affiliate);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Users className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Affiliation</h1>
            <p className="text-muted-foreground">Gestion des affiliés et commissions</p>
          </div>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setIsCreateDialogOpen(true);
          }}
          className="bg-amber-500 hover:bg-amber-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvel affilié
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Affiliés</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalAffiliates}</p>
            <p className="text-xs text-muted-foreground">{stats.activeAffiliates} actifs</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Tenants apportés</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalTenants}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Total généré</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalCommissionsGenerated)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">À payer (due)</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-orange-600">{formatCurrency(stats.totalDue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Payé</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{formatCurrency(stats.totalPaid)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">En cours</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.activeCommissions}</p>
            <p className="text-xs text-muted-foreground">{stats.completedCommissions} terminés</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un affilié..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Affiliates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des affiliés</CardTitle>
        </CardHeader>
        <CardContent>
          {loading || statsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-muted border-t-primary" />
            </div>
          ) : filteredAffiliates.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucun affilié trouvé</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all" 
                  ? "Essayez de modifier vos filtres"
                  : "Créez votre premier affilié pour commencer"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un affilié
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Affilié</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Taux</TableHead>
                  <TableHead className="text-right">Tenants</TableHead>
                  <TableHead className="text-right">Total généré</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-right">Payé</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAffiliates.map((affiliate) => (
                  <TableRow key={affiliate.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {affiliate.first_name} {affiliate.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{affiliate.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={affiliate.status === "active" ? "default" : "secondary"}>
                        {affiliate.status === "active" ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {affiliate.commission_rate}%
                    </TableCell>
                    <TableCell className="text-right">
                      {affiliate.tenants_count}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(affiliate.total_commissions)}
                    </TableCell>
                    <TableCell className="text-right text-orange-600">
                      {formatCurrency(affiliate.total_due)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {formatCurrency(affiliate.total_paid)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/king/affiliates/${affiliate.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(affiliate)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => openDeleteDialog(affiliate)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <DataPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={goToPage}
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nouvel affilié</DialogTitle>
            <DialogDescription>
              Ajoutez un nouvel affilié pour le programme de parrainage
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Dupont"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="jean.dupont@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ref_code">Code court (lien lyta.ch?ref=)</Label>
                <Input
                  id="ref_code"
                  type="text"
                  placeholder="ex: HABIB"
                  value={formData.ref_code}
                  onChange={(e) => setFormData({ ...formData, ref_code: e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase().slice(0, 30) })}
                />
                <p className="text-xs text-muted-foreground">3-30 caractères, alphanumériques. Le lien sera lyta.ch?ref={formData.ref_code.toLowerCase() || "CODE"}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_eligibility_months">Durée éligibilité (mois)</Label>
                <Input
                  id="default_eligibility_months"
                  type="number"
                  min={1}
                  max={60}
                  value={formData.default_eligibility_months}
                  onChange={(e) => setFormData({ ...formData, default_eligibility_months: parseInt(e.target.value, 10) || 12 })}
                />
                <p className="text-xs text-muted-foreground">Période pendant laquelle l'affilié touche des commissions sur ce tenant.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commission_rate">Taux de commission (%)</Label>
                <Input
                  id="commission_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={formData.commission_rate}
                  onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Statut</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as "active" | "inactive" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes internes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes optionnelles..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={isSubmitting || !formData.first_name || !formData.last_name || !formData.email}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isSubmitting ? "Création..." : "Créer l'affilié"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier l'affilié</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l'affilié
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_first_name">Prénom *</Label>
                <Input
                  id="edit_first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_last_name">Nom *</Label>
                <Input
                  id="edit_last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_email">Email *</Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_commission_rate">Taux de commission (%)</Label>
                <Input
                  id="edit_commission_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={formData.commission_rate}
                  onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_status">Statut</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({ ...formData, status: v as "active" | "inactive" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_notes">Notes internes</Label>
              <Textarea
                id="edit_notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleEdit} 
              disabled={isSubmitting || !formData.first_name || !formData.last_name || !formData.email}
            >
              {isSubmitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l'affilié</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedAffiliate?.first_name} {selectedAffiliate?.last_name} ?
              Cette action est irréversible et supprimera également toutes les commissions associées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
