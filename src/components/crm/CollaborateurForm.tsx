import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Collaborateur, CollaborateurFormData } from "@/hooks/useCollaborateurs";

interface CollaborateurFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborateur?: Collaborateur | null;
  onSubmit: (data: CollaborateurFormData) => Promise<boolean>;
}

const professionOptions = [
  { value: "agent", label: "Agent" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Administrateur" },
  { value: "backoffice", label: "Backoffice" },
  { value: "comptabilite", label: "Comptabilité" },
  { value: "direction", label: "Direction" },
];

export function CollaborateurForm({ open, onOpenChange, collaborateur, onSubmit }: CollaborateurFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CollaborateurFormData>({
    first_name: "",
    last_name: "",
    email: "",
    mobile: "",
    profession: "",
    status: "actif"
  });

  useEffect(() => {
    if (collaborateur) {
      setFormData({
        first_name: collaborateur.first_name || "",
        last_name: collaborateur.last_name || "",
        email: collaborateur.email || "",
        mobile: collaborateur.mobile || "",
        profession: collaborateur.profession || "",
        status: collaborateur.status || "actif"
      });
    } else {
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        mobile: "",
        profession: "",
        status: "actif"
      });
    }
  }, [collaborateur, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const success = await onSubmit(formData);
    
    setLoading(false);
    if (success) {
      onOpenChange(false);
    }
  };

  const isEditing = !!collaborateur;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le collaborateur" : "Nouveau collaborateur"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Prénom *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Nom *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile">Téléphone</Label>
            <Input
              id="mobile"
              type="tel"
              value={formData.mobile}
              onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profession">Fonction</Label>
              <Select
                value={formData.profession}
                onValueChange={(value) => setFormData(prev => ({ ...prev, profession: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {professionOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="actif">Actif</SelectItem>
                  <SelectItem value="inactif">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
