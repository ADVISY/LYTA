import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Wallet, Briefcase, Users, PiggyBank } from "lucide-react";
import { Collaborateur, CollaborateurFormData, useCollaborateurs } from "@/hooks/useCollaborateurs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollaboratorPhotoUpload } from "./CollaboratorPhotoUpload";

interface CollaborateurFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborateur?: Collaborateur | null;
  onSubmit: (data: CollaborateurFormData) => Promise<boolean>;
}

const getProfessionOptions = (t: (key: string) => string) => [
  { value: "agent", label: t("forms.professions.agent") },
  { value: "manager", label: t("forms.professions.manager") },
  { value: "admin", label: t("forms.professions.admin") },
  { value: "backoffice", label: t("forms.professions.backoffice") },
  { value: "comptabilite", label: t("forms.professions.comptabilite") },
  { value: "direction", label: t("forms.professions.direction") },
];

const getContractTypeOptions = (t: (key: string) => string) => [
  { value: "cdi", label: t("forms.contractTypes.cdi") },
  { value: "cdd", label: t("forms.contractTypes.cdd") },
  { value: "freelance", label: t("forms.contractTypes.freelance") },
  { value: "stagiaire", label: t("forms.contractTypes.stagiaire") },
];

export function CollaborateurForm({ open, onOpenChange, collaborateur, onSubmit }: CollaborateurFormProps) {
  const { t } = useTranslation();
  const { collaborateurs } = useCollaborateurs();
  const professionOptions = getProfessionOptions(t);
  const contractTypeOptions = getContractTypeOptions(t);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CollaborateurFormData>({
    first_name: "",
    last_name: "",
    email: "",
    mobile: "",
    profession: "",
    status: "actif",
    manager_id: null,
    commission_rate: 0,
    commission_rate_lca: 0,
    commission_rate_vie: 0,
    fixed_salary: 0,
    bonus_rate: 0,
    contract_type: "cdi",
    work_percentage: 100,
    hire_date: "",
    manager_commission_rate_lca: 0,
    manager_commission_rate_vie: 0,
    reserve_rate: 0,
  });

  // Filter managers (collaborateurs with profession "manager" or "direction") - case insensitive
  const availableManagers = collaborateurs.filter(c => {
    if (c.id === collaborateur?.id) return false;
    const profession = c.profession?.toLowerCase() || '';
    return profession === 'manager' || profession === 'direction';
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
        manager_id: collaborateur.manager_id || null,
        commission_rate: collaborateur.commission_rate || 0,
        commission_rate_lca: collaborateur.commission_rate_lca || 0,
        commission_rate_vie: collaborateur.commission_rate_vie || 0,
        fixed_salary: collaborateur.fixed_salary || 0,
        bonus_rate: collaborateur.bonus_rate || 0,
        contract_type: collaborateur.contract_type || "cdi",
        work_percentage: collaborateur.work_percentage || 100,
        hire_date: collaborateur.hire_date || "",
        manager_commission_rate_lca: collaborateur.manager_commission_rate_lca || 0,
        manager_commission_rate_vie: collaborateur.manager_commission_rate_vie || 0,
        reserve_rate: collaborateur.reserve_rate || 0,
      });
    } else {
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        mobile: "",
        profession: "",
        status: "actif",
        manager_id: null,
        commission_rate: 0,
        commission_rate_lca: 0,
        commission_rate_vie: 0,
        fixed_salary: 0,
        bonus_rate: 0,
        contract_type: "cdi",
        work_percentage: 100,
        hire_date: "",
        manager_commission_rate_lca: 0,
        manager_commission_rate_vie: 0,
        reserve_rate: 0,
      });
    }
  }, [collaborateur, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Clean data before submit - convert empty strings to null for optional fields
    const cleanedData: CollaborateurFormData = {
      ...formData,
      hire_date: formData.hire_date || undefined,
      manager_id: formData.manager_id || null,
      mobile: formData.mobile || undefined,
      profession: formData.profession || undefined,
    };
    
    const success = await onSubmit(cleanedData);
    
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
            {isEditing ? t("forms.collaborateur.editTitle") : t("forms.collaborateur.newTitle")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="info" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {t("forms.collaborateur.tabs.info")}
              </TabsTrigger>
              <TabsTrigger value="contrat" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                {t("forms.collaborateur.tabs.contract")}
              </TabsTrigger>
              <TabsTrigger value="remuneration" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                {t("forms.collaborateur.tabs.remuneration")}
              </TabsTrigger>
            </TabsList>

            {/* Tab: Informations personnelles */}
            <TabsContent value="info" className="space-y-4">
              {/* Photo Upload */}
              <div className="flex justify-center pb-4 border-b">
                <CollaboratorPhotoUpload
                  collaboratorId={collaborateur?.id}
                  currentPhotoUrl={collaborateur?.photo_url}
                  firstName={formData.first_name}
                  lastName={formData.last_name}
                  size="lg"
                  editable={true}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t("forms.collaborateur.firstName")} *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">{t("forms.collaborateur.lastName")} *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("forms.collaborateur.email")} *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile">{t("forms.collaborateur.phone")}</Label>
                <Input
                  id="mobile"
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profession">{t("forms.collaborateur.function")}</Label>
                  <Select
                    value={formData.profession}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, profession: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("common.select")} />
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
                  <Label htmlFor="status">{t("forms.collaborateur.status")}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="actif">{t("forms.collaborateur.statusActive")}</SelectItem>
                      <SelectItem value="inactif">{t("forms.collaborateur.statusInactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manager_id" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t("forms.collaborateur.manager")}
                </Label>
                <Select
                  value={formData.manager_id || "none"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, manager_id: value === "none" ? null : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("forms.collaborateur.noManager")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("forms.collaborateur.noManager")}</SelectItem>
                    {availableManagers.map(manager => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.first_name} {manager.last_name} ({manager.profession})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("forms.collaborateur.managerNote")}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="contrat" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contract_type">{t("forms.collaborateur.contractType")}</Label>
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
                  <Label htmlFor="work_percentage">{t("forms.collaborateur.activityRate")}</Label>
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
                <Label htmlFor="hire_date">{t("forms.collaborateur.hireDate")}</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, hire_date: e.target.value }))}
                />
              </div>
            </TabsContent>

            <TabsContent value="remuneration" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fixed_salary">{t("forms.collaborateur.fixedSalary")}</Label>
                <Input
                  id="fixed_salary"
                  type="number"
                  min="0"
                  step="100"
                  value={formData.fixed_salary}
                  onChange={(e) => setFormData(prev => ({ ...prev, fixed_salary: Number(e.target.value) }))}
                />
              </div>

              <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg space-y-4">
                <p className="text-sm font-medium flex items-center gap-2 text-primary">
                  <User className="h-4 w-4" />
                  {t("forms.collaborateur.personalCommissions")}
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="commission_rate">{t("forms.collaborateur.generalCommission")}</Label>
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
                    <Label htmlFor="commission_rate_lca" className="text-blue-600">{t("forms.collaborateur.lcaCommission")}</Label>
                    <Input
                      id="commission_rate_lca"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={formData.commission_rate_lca}
                      onChange={(e) => setFormData(prev => ({ ...prev, commission_rate_lca: Number(e.target.value) }))}
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commission_rate_vie" className="text-emerald-600">{t("forms.collaborateur.vieCommission")}</Label>
                    <Input
                      id="commission_rate_vie"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={formData.commission_rate_vie}
                      onChange={(e) => setFormData(prev => ({ ...prev, commission_rate_vie: Number(e.target.value) }))}
                      className="border-emerald-200 focus:border-emerald-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("forms.collaborateur.personalCommissionsNote")}
                </p>
              </div>

              {(formData.profession?.toLowerCase() === 'manager' || formData.profession?.toLowerCase() === 'direction') && (
                <div className="p-4 border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg space-y-4">
                  <p className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Users className="h-4 w-4" />
                    {t("forms.collaborateur.teamCommissions")}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="manager_commission_rate_lca" className="text-blue-600">
                        {t("forms.collaborateur.teamLcaCommission")}
                      </Label>
                      <Input
                        id="manager_commission_rate_lca"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={formData.manager_commission_rate_lca}
                        onChange={(e) => setFormData(prev => ({ ...prev, manager_commission_rate_lca: Number(e.target.value) }))}
                        className="border-blue-200 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager_commission_rate_vie" className="text-emerald-600">
                        {t("forms.collaborateur.teamVieCommission")}
                      </Label>
                      <Input
                        id="manager_commission_rate_vie"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={formData.manager_commission_rate_vie}
                        onChange={(e) => setFormData(prev => ({ ...prev, manager_commission_rate_vie: Number(e.target.value) }))}
                        className="border-emerald-200 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("forms.collaborateur.teamCommissionsNote")}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bonus_rate">{t("forms.collaborateur.bonusRate")}</Label>
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

                <div className="space-y-2">
                  <Label htmlFor="reserve_rate" className="flex items-center gap-2">
                    <PiggyBank className="h-4 w-4 text-orange-500" />
                    {t("forms.collaborateur.reserveAccount")}
                  </Label>
                  <Select
                    value={String(formData.reserve_rate || 0)}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, reserve_rate: Number(value) }))}
                  >
                    <SelectTrigger className="border-orange-200 focus:border-orange-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t("forms.collaborateur.reserveOptions.none")}</SelectItem>
                      <SelectItem value="10">{t("forms.collaborateur.reserveOptions.standard")}</SelectItem>
                      <SelectItem value="20">{t("forms.collaborateur.reserveOptions.high")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t("forms.collaborateur.reserveNote")}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">{t("forms.collaborateur.preview.title")}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">{t("forms.collaborateur.preview.fixedSalary")}:</span>
                  <span className="font-medium">{formData.fixed_salary?.toLocaleString('fr-CH')} CHF/{t("common.month")}</span>
                  <span className="text-muted-foreground">{t("forms.collaborateur.preview.generalCommission")}:</span>
                  <span className="font-medium">{formData.commission_rate}%</span>
                  <span className="text-blue-600">{t("forms.collaborateur.preview.lcaCommission")}:</span>
                  <span className="font-medium text-blue-600">{formData.commission_rate_lca}%</span>
                  <span className="text-emerald-600">{t("forms.collaborateur.preview.vieCommission")}:</span>
                  <span className="font-medium text-emerald-600">{formData.commission_rate_vie}%</span>
                  {(formData.profession === 'manager' || formData.profession === 'direction') && (
                    <>
                      <span className="text-amber-600">{t("forms.collaborateur.preview.teamLca")}:</span>
                      <span className="font-medium text-amber-600">{formData.manager_commission_rate_lca}%</span>
                      <span className="text-amber-600">{t("forms.collaborateur.preview.teamVie")}:</span>
                      <span className="font-medium text-amber-600">{formData.manager_commission_rate_vie}%</span>
                    </>
                  )}
                  <span className="text-muted-foreground">{t("forms.collaborateur.preview.bonus")}:</span>
                  <span className="font-medium">{formData.bonus_rate}%</span>
                  <span className="text-orange-600">{t("forms.collaborateur.preview.reserve")}:</span>
                  <span className="font-medium text-orange-600">{formData.reserve_rate}%</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? t("common.save") : t("common.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
