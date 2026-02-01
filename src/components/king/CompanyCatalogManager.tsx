import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsuranceCompanies, InsuranceCompany } from "@/hooks/useInsuranceCompanies";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Image,
} from "lucide-react";

export default function CompanyCatalogManager() {
  const { companies, loading, fetchCompanies } = useInsuranceCompanies();
  const { toast } = useToast();
  
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<InsuranceCompany | null>(null);
  const [formName, setFormName] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingCompany(null);
    setFormName('');
    setFormLogoUrl('');
    setDialogOpen(true);
  };

  const openEditDialog = (company: InsuranceCompany) => {
    setEditingCompany(company);
    setFormName(company.name);
    setFormLogoUrl(company.logo_url || '');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingCompany) {
        const { error } = await supabase
          .from('insurance_companies' as any)
          .update({
            name: formName.trim(),
            logo_url: formLogoUrl.trim() || null,
          })
          .eq('id', editingCompany.id);

        if (error) throw error;
        toast({ title: "Compagnie modifiée" });
      } else {
        const { error } = await supabase
          .from('insurance_companies' as any)
          .insert({
            name: formName.trim(),
            logo_url: formLogoUrl.trim() || null,
          });

        if (error) throw error;
        toast({ title: "Compagnie créée" });
      }

      await fetchCompanies();
      setDialogOpen(false);
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (companyId: string) => {
    if (!confirm('Supprimer cette compagnie ? Tous les produits associés seront également supprimés.')) return;

    try {
      const { error } = await supabase
        .from('insurance_companies' as any)
        .delete()
        .eq('id', companyId);

      if (error) throw error;
      toast({ title: "Compagnie supprimée" });
      await fetchCompanies();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Compagnies d'assurance</h2>
            <p className="text-muted-foreground">{companies.length} compagnies</p>
          </div>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle compagnie
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une compagnie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Logo</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map(company => (
                  <TableRow key={company.id}>
                    <TableCell>
                      {company.logo_url ? (
                        <img 
                          src={company.logo_url} 
                          alt={company.name} 
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        <div className="h-8 w-8 bg-muted rounded flex items-center justify-center">
                          <Image className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{company.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(company.created_at).toLocaleDateString('fr-CH')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(company)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(company.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCompanies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      Aucune compagnie trouvée
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? 'Modifier la compagnie' : 'Nouvelle compagnie'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Groupe Mutuel"
              />
            </div>

            <div className="space-y-2">
              <Label>URL du logo</Label>
              <Input
                value={formLogoUrl}
                onChange={(e) => setFormLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !formName.trim()}>
              {isSubmitting ? 'Enregistrement...' : (editingCompany ? 'Modifier' : 'Créer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
