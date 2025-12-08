import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Wallet, Briefcase } from "lucide-react";
import { Collaborateur, CollaborateurFormData } from "@/hooks/useCollaborateurs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const contractTypeOptions = [
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
  { value: "freelance", label: "Freelance" },
  { value: "stagiaire", label: "Stagiaire" },
];

export function CollaborateurForm({ open, onOpenChange, collaborateur, onSubmit }: CollaborateurFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CollaborateurFormData>({
    first_name: "",
    last_name: "",
    email: "",
    mobile: "",
    profession: "",
    status: "actif",
    commission_rate: 0,
    fixed_salary: 0,
    bonus_rate: 0,
    contract_type: "cdi",
    work_percentage: 100,
    hire_date: ""
  });

  useEffect(() => {
    if (collaborateur) {
      setFormData({
        first_name: collaborateur.first_name || "",
        last_name: collaborateur.last_name || "",
        email: collaborateur.email || "",
        mobile: collaborateur.mobile || "",
        profession: collaborateur.profession || "",
        status: collaborateur.status || "actif",
        commission_rate: collaborateur.commission_rate || 0,
        fixed_salary: collaborateur.fixed_salary || 0,
        bonus_rate: collaborateur.bonus_rate || 0,
        contract_type: collaborateur.contract_type || "cdi",
        work_percentage: collaborateur.work_percentage || 100,
        hire_date: collaborateur.hire_date || ""
      });
    } else {
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        mobile: "",
        profession: "",
        status: "actif",
        commission_rate: 0,
        fixed_salary: 0,
        bonus_rate: 0,
        contract_type: "cdi",
        work_percentage: 100,
        hire_date: ""
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
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le collaborateur" : "Nouveau collaborateur"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="info" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Informations
              </TabsTrigger>
              <TabsTrigger value="contrat" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Contrat
              </TabsTrigger>
              <TabsTrigger value="remuneration" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Rémunération
              </TabsTrigger>
            </TabsList>

            {/* Tab: Informations personnelles */}
            <TabsContent value="info" className="space-y-4">
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
            </TabsContent>

            {/* Tab: Contrat */}
            <TabsContent value="contrat" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contract_type">Type de contrat</Label>
                  <Select
                    value={formData.contract_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, contract_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {contractTypeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="work_percentage">Taux d'activité (%)</Label>
                  <Input
                    id="work_percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.work_percentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, work_percentage: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hire_date">Date d'embauche</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, hire_date: e.target.value }))}
                />
              </div>
            </TabsContent>

            {/* Tab: Rémunération */}
            <TabsContent value="remuneration" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fixed_salary">Salaire fixe mensuel (CHF)</Label>
                <Input
                  id="fixed_salary"
                  type="number"
                  min="0"
                  step="100"
                  value={formData.fixed_salary}
                  onChange={(e) => setFormData(prev => ({ ...prev, fixed_salary: Number(e.target.value) }))}
                />
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
                    onChange={(e) => setFormData(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bonus_rate">Taux de bonus (%)</Label>
                  <Input
                    id="bonus_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.bonus_rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, bonus_rate: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">Aperçu de la rémunération</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Salaire fixe:</span>
                  <span className="font-medium">{formData.fixed_salary?.toLocaleString('fr-CH')} CHF/mois</span>
                  <span className="text-muted-foreground">Commission:</span>
                  <span className="font-medium">{formData.commission_rate}% des affaires</span>
                  <span className="text-muted-foreground">Bonus:</span>
                  <span className="font-medium">{formData.bonus_rate}%</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-6">
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
