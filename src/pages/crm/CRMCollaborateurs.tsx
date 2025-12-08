import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  UserCog, Plus, Users, Search, Edit, Trash2, 
  Phone, Mail, Briefcase, UserCheck, UserX, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollaborateurs, Collaborateur, CollaborateurFormData } from "@/hooks/useCollaborateurs";
import { CollaborateurForm } from "@/components/crm/CollaborateurForm";
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
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const professionLabels: Record<string, string> = {
  agent: "Agent",
  manager: "Manager",
  admin: "Administrateur",
  backoffice: "Backoffice",
  comptabilite: "Comptabilité",
  direction: "Direction",
};

export default function CRMCollaborateurs() {
  const { collaborateurs, loading, stats, addCollaborateur, updateCollaborateur, deleteCollaborateur } = useCollaborateurs();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCollaborateur, setEditingCollaborateur] = useState<Collaborateur | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [collaborateurToDelete, setCollaborateurToDelete] = useState<Collaborateur | null>(null);

  const filteredCollaborateurs = useMemo(() => {
    if (!search.trim()) return collaborateurs;
    const searchLower = search.toLowerCase();
    return collaborateurs.filter(c => 
      c.first_name?.toLowerCase().includes(searchLower) ||
      c.last_name?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower) ||
      c.profession?.toLowerCase().includes(searchLower)
    );
  }, [collaborateurs, search]);

  const handleAdd = () => {
    setEditingCollaborateur(null);
    setFormOpen(true);
  };

  const handleEdit = (collaborateur: Collaborateur) => {
    setEditingCollaborateur(collaborateur);
    setFormOpen(true);
  };

  const handleDeleteClick = (collaborateur: Collaborateur) => {
    setCollaborateurToDelete(collaborateur);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (collaborateurToDelete) {
      await deleteCollaborateur(collaborateurToDelete.id);
      setDeleteDialogOpen(false);
      setCollaborateurToDelete(null);
    }
  };

  const handleFormSubmit = async (data: CollaborateurFormData) => {
    if (editingCollaborateur) {
      return await updateCollaborateur(editingCollaborateur.id, data);
    } else {
      return await addCollaborateur(data);
    }
  };

  const statsCards = [
    { label: "Total", value: stats.total, icon: Users, color: "from-blue-500 to-indigo-600" },
    { label: "Actifs", value: stats.actifs, icon: UserCheck, color: "from-emerald-500 to-teal-600" },
    { label: "Inactifs", value: stats.inactifs, icon: UserX, color: "from-gray-400 to-gray-500" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-transparent rounded-3xl blur-2xl" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl blur-lg opacity-50" />
              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-xl">
                <UserCog className="h-7 w-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Collaborateurs
              </h1>
              <p className="text-muted-foreground">Gérez votre équipe Advisy</p>
            </div>
          </div>
          <Button 
            onClick={handleAdd}
            className="group bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-xl shadow-primary/20 rounded-xl"
          >
            <Plus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90 duration-300" />
            Ajouter un collaborateur
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {statsCards.map((stat, index) => (
          <Card 
            key={stat.label} 
            className="group border-0 shadow-lg bg-white/80 dark:bg-card/80 backdrop-blur hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden"
          >
            <div className={cn(
              "absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-10 blur-2xl bg-gradient-to-br",
              stat.color
            )} />
            <CardContent className="p-5 relative">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "p-2.5 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
                  stat.color
                )}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Table */}
      <Card className="border-0 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Liste des collaborateurs</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCollaborateurs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "Aucun résultat trouvé" : "Aucun collaborateur enregistré"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Fonction</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Ajouté le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollaborateurs.map((collaborateur) => (
                    <TableRow key={collaborateur.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {collaborateur.first_name?.[0]}{collaborateur.last_name?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {collaborateur.first_name} {collaborateur.last_name}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {collaborateur.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {collaborateur.email}
                            </div>
                          )}
                          {collaborateur.mobile && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {collaborateur.mobile}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {collaborateur.profession ? (
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-3 w-3 text-muted-foreground" />
                            <span>{professionLabels[collaborateur.profession] || collaborateur.profession}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={collaborateur.status === 'actif' ? 'default' : 'secondary'}
                          className={cn(
                            collaborateur.status === 'actif' 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                              : 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {collaborateur.status === 'actif' ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(collaborateur.created_at), 'dd MMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => handleEdit(collaborateur)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(collaborateur)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <CollaborateurForm
        open={formOpen}
        onOpenChange={setFormOpen}
        collaborateur={editingCollaborateur}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce collaborateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {collaborateurToDelete?.first_name} {collaborateurToDelete?.last_name} ? 
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
