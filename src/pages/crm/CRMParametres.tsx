import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, User, Building2, Package, Percent, Moon, Sun, 
  Palette, Save, Pencil, Trash2, Plus, Shield, Eye, EyeOff, Check,
  Users, UserCheck, AlertCircle, Loader2, KeyRound, Mail, Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserTenant } from "@/hooks/useUserTenant";
import { useTenantSeats } from "@/hooks/useTenantSeats";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RolesManager } from "@/components/crm/settings/RolesManager";
import { UserRolesManager } from "@/components/crm/settings/UserRolesManager";
import { EmailAutomationSettings } from "@/components/crm/settings/EmailAutomationSettings";
import { AddUserSeatDialog } from "@/components/crm/settings/AddUserSeatDialog";

// Couleurs disponibles pour le thème - needs to be inside component to use translations
const getThemeColors = (t: any) => [
  { id: "blue", label: t('settings.blue'), color: "hsl(221, 83%, 53%)", class: "bg-blue-600" },
  { id: "violet", label: t('settings.violet'), color: "hsl(262, 83%, 58%)", class: "bg-violet-600" },
  { id: "green", label: t('settings.green'), color: "hsl(142, 76%, 36%)", class: "bg-green-600" },
  { id: "orange", label: t('settings.orange'), color: "hsl(24, 95%, 53%)", class: "bg-orange-500" },
  { id: "red", label: t('settings.red'), color: "hsl(0, 84%, 60%)", class: "bg-red-500" },
  { id: "pink", label: t('settings.pink'), color: "hsl(330, 81%, 60%)", class: "bg-pink-500" },
  { id: "teal", label: t('settings.teal'), color: "hsl(173, 80%, 40%)", class: "bg-teal-500" },
  { id: "indigo", label: t('settings.indigo'), color: "hsl(239, 84%, 67%)", class: "bg-indigo-500" },
];

const getRoleLabels = (t: any): Record<string, string> => ({
  admin: t('settings.admin'),
  manager: t('settings.manager'),
  agent: t('settings.agent'),
  backoffice: t('settings.backoffice'),
  compta: t('settings.compta'),
  client: t('settings.client'),
  partner: t('settings.partner'),
});

const roleBadgeColors: Record<string, string> = {
  admin: "bg-red-500",
  manager: "bg-blue-500",
  agent: "bg-green-500",
  backoffice: "bg-orange-500",
  compta: "bg-purple-500",
  client: "bg-gray-500",
  partner: "bg-teal-500",
};

export default function CRMParametres() {
  const { t } = useTranslation();
  const { user, session } = useAuth();
  const { tenantId } = useUserTenant();
  const tenantSeats = useTenantSeats();
  const [activeTab, setActiveTab] = useState("profil");
  const [showUnlockSeatDialog, setShowUnlockSeatDialog] = useState(false);
  
  const themeColors = getThemeColors(t);
  const roleLabels = getRoleLabels(t);
  
  // Profil
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);

  // Compagnies
  const [companies, setCompanies] = useState<any[]>([]);
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", logo_url: "" });
  const [editingCompany, setEditingCompany] = useState<any>(null);

  // Produits
  const [products, setProducts] = useState<any[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", category: "", company_id: "", description: "" });
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Taux de commission par défaut
  const [defaultRates, setDefaultRates] = useState({
    lca: 16,
    vie: 4,
    manager_lca: 2,
    manager_vie: 1,
    reserve: 10,
  });

  // Apparence
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState("blue");

  // Gestion des comptes
  const [userAccounts, setUserAccounts] = useState<any[]>([]);
  const [collaborateurs, setCollaborateurs] = useState<any[]>([]);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    role: "agent",
    collaborateurId: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Handler pour cliquer sur "Créer un compte"
  const handleAddUserClick = () => {
    if (!tenantSeats.canAddUser) {
      // Pas de siège disponible - afficher le dialog de déblocage
      setShowUnlockSeatDialog(true);
    } else {
      // Siège disponible - ouvrir le formulaire de création
      setIsAddingAccount(true);
    }
  };

  // Handler après ajout de siège réussi
  const handleSeatAdded = () => {
    tenantSeats.refresh();
    // Maintenant ouvrir le formulaire de création
    setIsAddingAccount(true);
  };

  // Charger les données
  useEffect(() => {
    loadProfile();
    loadCompanies();
    loadProducts();
    loadSettings();
    if (tenantId) {
      loadUserAccounts();
      loadCollaborateurs();
    }
  }, [user, tenantId]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setProfile({
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        email: data.email || user.email || "",
        phone: data.phone || "",
      });
    }
  };

  const loadCompanies = async () => {
    const { data } = await supabase.from("insurance_companies").select("*").order("name");
    if (data) setCompanies(data);
  };

  const loadProducts = async () => {
    const { data } = await supabase
      .from("insurance_products")
      .select("*, company:insurance_companies(name)")
      .order("name");
    if (data) setProducts(data);
  };

  const loadSettings = () => {
    const saved = localStorage.getItem("crm_settings");
    if (saved) {
      const settings = JSON.parse(saved);
      setIsDarkMode(settings.darkMode || false);
      setSelectedColor(settings.themeColor || "blue");
      setDefaultRates(settings.defaultRates || defaultRates);
    }
    
    if (localStorage.getItem("crm_dark_mode") === "true") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  };

  const loadUserAccounts = async () => {
    if (!tenantId) return;

    // Get user IDs assigned to this tenant
    const { data: tenantUsers, error: tenantError } = await supabase
      .from("user_tenant_assignments")
      .select("user_id")
      .eq("tenant_id", tenantId);

    if (tenantError) {
      console.error("Error loading tenant users:", tenantError);
      return;
    }

    const tenantUserIds = tenantUsers?.map(tu => tu.user_id) || [];
    
    if (tenantUserIds.length === 0) {
      setUserAccounts([]);
      return;
    }

    // Get user accounts with their roles filtered by tenant users
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select(`
        id,
        user_id,
        role,
        created_at,
        profiles:user_id (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .in("user_id", tenantUserIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading user accounts:", error);
      return;
    }

    // Get linked collaborateurs for this tenant
    const { data: linkedCollabs } = await supabase
      .from("clients")
      .select("id, user_id, first_name, last_name")
      .eq("type_adresse", "collaborateur")
      .eq("tenant_id", tenantId)
      .not("user_id", "is", null);

    const collabMap = new Map();
    linkedCollabs?.forEach(c => {
      collabMap.set(c.user_id, c);
    });

    const accounts = roles?.map(r => ({
      ...r,
      collaborateur: collabMap.get(r.user_id) || null,
    })) || [];

    setUserAccounts(accounts);
  };

  const loadCollaborateurs = async () => {
    if (!tenantId) return;
    
    // Get collaborateurs without linked user accounts for this tenant
    const { data } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email")
      .eq("type_adresse", "collaborateur")
      .eq("tenant_id", tenantId)
      .is("user_id", null)
      .order("last_name");
    
    setCollaborateurs(data || []);
  };

  const saveSettings = () => {
    localStorage.setItem("crm_settings", JSON.stringify({
      darkMode: isDarkMode,
      themeColor: selectedColor,
      defaultRates,
    }));
    toast.success(t('settings.saved'));
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: profile.firstName,
        last_name: profile.lastName,
        phone: profile.phone,
      })
      .eq("id", user.id);

    if (error) {
      toast.error(t('settings.profileUpdateError'));
    } else {
      toast.success(t('settings.profileUpdated'));
      setIsEditingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }
    if (passwords.new.length < 8) {
      toast.error(t('settings.passwordTooShort'));
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: passwords.new,
    });

    if (error) {
      toast.error(t('settings.passwordChangeError'));
    } else {
      toast.success(t('settings.passwordChanged'));
      setShowPasswordChange(false);
      setPasswords({ current: "", new: "", confirm: "" });
    }
  };

  const handleResetPassword = async () => {
    if (!profile.email) return;
    
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email);
    if (error) {
      toast.error(t('settings.resetEmailError'));
    } else {
      toast.success(t('settings.resetEmailSent'));
    }
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem("crm_dark_mode", String(newMode));
    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // CRUD Compagnies
  const handleAddCompany = async () => {
    if (!newCompany.name.trim()) {
      toast.error(t('settings.companyNameRequired'));
      return;
    }
    const { error } = await supabase.from("insurance_companies").insert(newCompany);
    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('settings.companyAdded'));
      setNewCompany({ name: "", logo_url: "" });
      setIsAddingCompany(false);
      loadCompanies();
    }
  };

  const handleUpdateCompany = async () => {
    if (!editingCompany) return;
    const { error } = await supabase
      .from("insurance_companies")
      .update({ name: editingCompany.name, logo_url: editingCompany.logo_url })
      .eq("id", editingCompany.id);
    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('settings.companyUpdated'));
      setEditingCompany(null);
      loadCompanies();
    }
  };

  const handleDeleteCompany = async (id: string) => {
    const { error } = await supabase.from("insurance_companies").delete().eq("id", id);
    if (error) {
      toast.error(t('settings.companyDeleteError'));
    } else {
      toast.success(t('settings.companyDeleted'));
      loadCompanies();
    }
  };

  // CRUD Produits
  const handleAddProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.company_id || !newProduct.category) {
      toast.error(t('settings.productRequired'));
      return;
    }
    const { error } = await supabase.from("insurance_products").insert(newProduct);
    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('settings.productAdded'));
      setNewProduct({ name: "", category: "", company_id: "", description: "" });
      setIsAddingProduct(false);
      loadProducts();
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    const { error } = await supabase
      .from("insurance_products")
      .update({
        name: editingProduct.name,
        category: editingProduct.category,
        company_id: editingProduct.company_id,
        description: editingProduct.description,
      })
      .eq("id", editingProduct.id);
    if (error) {
      toast.error(t('common.error'));
    } else {
      toast.success(t('settings.productUpdated'));
      setEditingProduct(null);
      loadProducts();
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const { error } = await supabase.from("insurance_products").delete().eq("id", id);
    if (error) {
      toast.error(t('settings.productDeleteError'));
    } else {
      toast.success(t('settings.productDeleted'));
      loadProducts();
    }
  };
  // Créer un compte utilisateur
  const handleCreateAccount = async () => {
    // Validations
    if (!newAccount.email.trim()) {
      toast.error(t('errors.requiredField'));
      return;
    }
    if (!newAccount.password || newAccount.password.length < 8) {
      toast.error(t('settings.passwordTooShort'));
      return;
    }
    if (newAccount.password !== newAccount.confirmPassword) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }
    if (!newAccount.collaborateurId) {
      toast.error(t('settings.selectCollaborator'));
      return;
    }

    setIsCreatingAccount(true);

    try {
      const selectedCollab = collaborateurs.find(c => c.id === newAccount.collaborateurId);
      
      const response = await supabase.functions.invoke("create-user-account", {
        body: {
          email: newAccount.email,
          password: newAccount.password,
          role: newAccount.role,
          collaborateurId: newAccount.collaborateurId,
          firstName: selectedCollab?.first_name,
          lastName: selectedCollab?.last_name,
        },
      });

      if (response.error) {
        toast.error(response.error.message || t('settings.accountCreationError'));
        return;
      }

      if (response.data?.error) {
        toast.error(response.data.error);
        return;
      }

      toast.success(t('settings.accountCreated'));
      setIsAddingAccount(false);
      setNewAccount({
        email: "",
        password: "",
        confirmPassword: "",
        role: "agent",
        collaborateurId: "",
      });
      loadUserAccounts();
      loadCollaborateurs();
    } catch (error: any) {
      console.error("Error creating account:", error);
      toast.error(t('settings.accountCreationError'));
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const getProductCategories = () => [
    { id: "health", label: t('settings.categoryHealth') },
    { id: "life", label: t('settings.categoryLife') },
    { id: "auto", label: t('settings.categoryAuto') },
    { id: "property", label: t('settings.categoryProperty') },
    { id: "legal", label: t('settings.categoryLegal') },
    { id: "lpp", label: t('settings.categoryLpp') },
    { id: "other", label: t('settings.categoryOther') },
  ];
  
  const productCategories = getProductCategories();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 shadow-lg">
          <Settings className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('nav.settings')}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto w-full max-w-4xl">
          <TabsTrigger value="profil" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.profile')}</span>
          </TabsTrigger>
          <TabsTrigger value="comptes" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.accounts')}</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.roles')}</span>
          </TabsTrigger>
          <TabsTrigger value="utilisateurs" className="gap-2">
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">{t('collaborators.permissions')}</span>
          </TabsTrigger>
          <TabsTrigger value="compagnies" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.companies')}</span>
          </TabsTrigger>
          <TabsTrigger value="produits" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.products')}</span>
          </TabsTrigger>
          <TabsTrigger value="commissions" className="gap-2">
            <Percent className="h-4 w-4" />
            <span className="hidden sm:inline">{t('nav.commissions')}</span>
          </TabsTrigger>
          <TabsTrigger value="apparence" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.appearance')}</span>
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">{t('emails.title')}</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.support')}</span>
          </TabsTrigger>
        </TabsList>

        {/* PROFIL */}
        <TabsContent value="profil" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('settings.personalInfo')}</CardTitle>
                {!isEditingProfile && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingProfile(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    {t('common.edit')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('settings.firstName')}</Label>
                  <Input 
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    disabled={!isEditingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.lastName')}</Label>
                  <Input 
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    disabled={!isEditingProfile}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('settings.email')}</Label>
                  <Input value={profile.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.phone')}</Label>
                  <Input 
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    disabled={!isEditingProfile}
                  />
                </div>
              </div>
              {isEditingProfile && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleUpdateProfile}>
                    <Save className="h-4 w-4 mr-2" />
                    {t('common.save')}
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditingProfile(false)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('settings.security')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showPasswordChange ? (
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setShowPasswordChange(true)}>
                    {t('settings.changePassword')}
                  </Button>
                  <Button variant="ghost" onClick={handleResetPassword}>
                    {t('settings.requestNewPassword')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label>{t('settings.newPassword')}</Label>
                    <div className="relative">
                      <Input 
                        type={showPasswords ? "text" : "password"}
                        value={passwords.new}
                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
                        onClick={() => setShowPasswords(!showPasswords)}
                      >
                        {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('settings.confirmPassword')}</Label>
                    <Input 
                      type={showPasswords ? "text" : "password"}
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleChangePassword}>
                      {t('settings.changePassword')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowPasswordChange(false)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GESTION DES COMPTES */}
        <TabsContent value="comptes" className="space-y-6 mt-6">
          {/* Infos sur les sièges utilisateurs */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{t('subscription.activeUsers')}</p>
                      <p className="text-2xl font-bold">{tenantSeats.activeUsers}</p>
                    </div>
                  </div>
                  <div className="border-l pl-6">
                    <p className="text-sm text-muted-foreground">{t('subscription.includedInPlan')}</p>
                    <p className="text-xl font-semibold">{tenantSeats.seatsIncluded}</p>
                  </div>
                  {tenantSeats.extraUsers > 0 && (
                    <div className="border-l pl-6">
                      <p className="text-sm text-muted-foreground">{t('subscription.extra')}</p>
                      <p className="text-xl font-semibold text-amber-600">+{tenantSeats.extraUsers}</p>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{t('settings.availableSeats')}</p>
                  <p className={cn(
                    "text-xl font-bold",
                    tenantSeats.availableSeats > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {tenantSeats.availableSeats}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerte si quota dépassé ou atteint */}
          {!tenantSeats.canAddUser && (
            <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
              <Lock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>{t('settings.noSeatsAvailable')}.</strong> {t('settings.unlockSeat')} (+{tenantSeats.seatPrice} CHF/{t('common.month')}).
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Workflow:</strong><br />
              1. {t('collaborators.addCollaborator')} dans <strong>{t('nav.collaborators')}</strong><br />
              2. {t('settings.createAccount')}
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  {t('settings.userAccounts')}
                </CardTitle>
                <Button size="sm" onClick={handleAddUserClick}>
                  {tenantSeats.canAddUser ? (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('settings.createAccount')}
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      {t('settings.unlockSeat')}
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('settings.users')}</TableHead>
                    <TableHead>{t('common.email')}</TableHead>
                    <TableHead>{t('collaborators.role')}</TableHead>
                    <TableHead>{t('settings.linkedCollaborator')}</TableHead>
                    <TableHead>{t('settings.createdAt')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userAccounts.map(account => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <span className="font-medium">
                          {account.profiles?.first_name} {account.profiles?.last_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {account.profiles?.email}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-white", roleBadgeColors[account.role] || "bg-gray-500")}>
                          {t(`settings.${account.role}`) || account.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {account.collaborateur ? (
                          <span className="text-sm">
                            {account.collaborateur.first_name} {account.collaborateur.last_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(account.created_at).toLocaleDateString("fr-CH")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {userAccounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {t('settings.noCollaboratorsAvailable')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Dialog de création de compte */}
          <Dialog open={isAddingAccount} onOpenChange={setIsAddingAccount}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Créer un compte utilisateur</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Collaborateur *</Label>
                  <Select 
                    value={newAccount.collaborateurId}
                    onValueChange={(v) => {
                      const collab = collaborateurs.find(c => c.id === v);
                      setNewAccount({ 
                        ...newAccount, 
                        collaborateurId: v,
                        email: collab?.email || newAccount.email
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un collaborateur..." />
                    </SelectTrigger>
                    <SelectContent>
                      {collaborateurs.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Aucun collaborateur disponible.<br />
                          Créez d'abord une fiche collaborateur.
                        </div>
                      ) : (
                        collaborateurs.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.first_name} {c.last_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Seuls les collaborateurs sans compte apparaissent ici
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input 
                    type="email"
                    value={newAccount.email}
                    onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                    placeholder="email@exemple.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mot de passe *</Label>
                  <div className="relative">
                    <Input 
                      type={showNewPassword ? "text" : "password"}
                      value={newAccount.password}
                      onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                      placeholder="Minimum 8 caractères"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Confirmer le mot de passe *</Label>
                  <Input 
                    type={showNewPassword ? "text" : "password"}
                    value={newAccount.confirmPassword}
                    onChange={(e) => setNewAccount({ ...newAccount, confirmPassword: e.target.value })}
                    placeholder="Confirmer le mot de passe"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Rôle *</Label>
                  <Select 
                    value={newAccount.role}
                    onValueChange={(v) => setNewAccount({ ...newAccount, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrateur</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="backoffice">Backoffice</SelectItem>
                      <SelectItem value="compta">Comptabilité</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Alert className="bg-muted">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Accès par rôle :</strong><br />
                    • <strong>Admin</strong> : Accès complet au CRM<br />
                    • <strong>Manager</strong> : Ses adresses + équipe (sans Compta/Commissions)<br />
                    • <strong>Agent</strong> : Uniquement ses propres adresses et contrats
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={handleCreateAccount} 
                    disabled={isCreatingAccount || collaborateurs.length === 0}
                    className="flex-1"
                  >
                    {isCreatingAccount ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Création...
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 mr-2" />
                        Créer le compte
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddingAccount(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* RÔLES */}
        <TabsContent value="roles" className="space-y-6 mt-6">
          <RolesManager />
        </TabsContent>

        {/* UTILISATEURS & PERMISSIONS */}
        <TabsContent value="utilisateurs" className="space-y-6 mt-6">
          <UserRolesManager />
        </TabsContent>

        {/* COMPAGNIES */}
        <TabsContent value="compagnies" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Compagnies d'assurance</CardTitle>
                <Button size="sm" onClick={() => setIsAddingCompany(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isAddingCompany && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/30 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input 
                        value={newCompany.name}
                        onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL du logo (optionnel)</Label>
                      <Input 
                        value={newCompany.logo_url}
                        onChange={(e) => setNewCompany({ ...newCompany, logo_url: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddCompany}>Ajouter</Button>
                    <Button size="sm" variant="outline" onClick={() => setIsAddingCompany(false)}>Annuler</Button>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Produits</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map(company => (
                    <TableRow key={company.id}>
                      <TableCell>
                        {editingCompany?.id === company.id ? (
                          <Input 
                            value={editingCompany.name}
                            onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                          />
                        ) : (
                          <span className="font-medium">{company.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {products.filter(p => p.company_id === company.id).length} produits
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {editingCompany?.id === company.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={handleUpdateCompany}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditingCompany(null)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setEditingCompany(company)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteCompany(company.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRODUITS */}
        <TabsContent value="produits" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Produits d'assurance</CardTitle>
                <Button size="sm" onClick={() => setIsAddingProduct(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isAddingProduct && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/30 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom du produit</Label>
                      <Input 
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Compagnie</Label>
                      <Select 
                        value={newProduct.company_id}
                        onValueChange={(v) => setNewProduct({ ...newProduct, company_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Catégorie</Label>
                      <Select 
                        value={newProduct.category}
                        onValueChange={(v) => setNewProduct({ ...newProduct, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {productCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Description (optionnel)</Label>
                      <Input 
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddProduct}>Ajouter</Button>
                    <Button size="sm" variant="outline" onClick={() => setIsAddingProduct(false)}>Annuler</Button>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Compagnie</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.slice(0, 20).map(product => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.company?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {productCategories.find(c => c.id === product.category)?.label || product.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditingProduct(product)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteProduct(product.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {products.length > 20 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Affichage de 20 produits sur {products.length}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Dialog d'édition produit */}
          <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifier le produit</DialogTitle>
              </DialogHeader>
              {editingProduct && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nom</Label>
                    <Input 
                      value={editingProduct.name}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Compagnie</Label>
                    <Select 
                      value={editingProduct.company_id}
                      onValueChange={(v) => setEditingProduct({ ...editingProduct, company_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select 
                      value={editingProduct.category}
                      onValueChange={(v) => setEditingProduct({ ...editingProduct, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {productCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateProduct}>Enregistrer</Button>
                    <Button variant="outline" onClick={() => setEditingProduct(null)}>Annuler</Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* COMMISSIONS */}
        <TabsContent value="commissions" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Taux de commission par défaut</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Taux agents</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Commission LCA (santé complémentaire)</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number"
                          value={defaultRates.lca}
                          onChange={(e) => setDefaultRates({ ...defaultRates, lca: Number(e.target.value) })}
                          className="w-20 text-right"
                        />
                        <span className="text-muted-foreground">×</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Commission VIE (3e pilier)</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number"
                          value={defaultRates.vie}
                          onChange={(e) => setDefaultRates({ ...defaultRates, vie: Number(e.target.value) })}
                          className="w-20 text-right"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Taux managers</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Part manager LCA</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number"
                          value={defaultRates.manager_lca}
                          onChange={(e) => setDefaultRates({ ...defaultRates, manager_lca: Number(e.target.value) })}
                          className="w-20 text-right"
                        />
                        <span className="text-muted-foreground">×</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Part manager VIE</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number"
                          value={defaultRates.manager_vie}
                          onChange={(e) => setDefaultRates({ ...defaultRates, manager_vie: Number(e.target.value) })}
                          className="w-20 text-right"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between max-w-md">
                  <Label>Taux de réserve par défaut</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number"
                      value={defaultRates.reserve}
                      onChange={(e) => setDefaultRates({ ...defaultRates, reserve: Number(e.target.value) })}
                      className="w-20 text-right"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              <Button onClick={saveSettings}>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer les taux
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* APPARENCE */}
        <TabsContent value="apparence" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Thème</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isDarkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  <div>
                    <p className="font-medium">Mode sombre</p>
                    <p className="text-sm text-muted-foreground">Basculer entre mode jour et mode nuit</p>
                  </div>
                </div>
                <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Couleur principale</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                {themeColors.map(color => (
                  <button
                    key={color.id}
                    onClick={() => {
                      setSelectedColor(color.id);
                      toast.success(`Couleur ${color.label} sélectionnée`);
                    }}
                    className={cn(
                      "w-12 h-12 rounded-full transition-all",
                      color.class,
                      selectedColor === color.id 
                        ? "ring-4 ring-offset-2 ring-offset-background scale-110" 
                        : "hover:scale-105"
                    )}
                    title={color.label}
                  >
                    {selectedColor === color.id && (
                      <Check className="h-6 w-6 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Note: Le changement de couleur nécessite un rechargement de la page.
              </p>
              <Button className="mt-4" onClick={saveSettings}>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMAILS */}
        <TabsContent value="emails" className="space-y-6 mt-6">
          <EmailAutomationSettings />
        </TabsContent>

        {/* SUPPORT */}
        <TabsContent value="support" className="space-y-6 mt-6">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                {t('common.technicalSupport')} LYTA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Pour toute question, problème technique, bug, demande d'upgrade ou autre besoin, 
                notre équipe support est à votre disposition.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 p-4 bg-background rounded-lg border">
                  <h4 className="font-medium mb-2">Email de support</h4>
                  <a 
                    href="mailto:support@lyta.ch"
                    className="text-lg font-mono text-primary hover:underline"
                  >
                    support@lyta.ch
                  </a>
                  <p className="text-xs text-muted-foreground mt-2">
                    Réponse sous 24-48h ouvrées
                  </p>
                </div>
                
                <div className="flex-1 p-4 bg-background rounded-lg border">
                  <h4 className="font-medium mb-2">Horaires</h4>
                  <p className="text-sm">Lundi - Vendredi</p>
                  <p className="text-lg font-medium">09:00 - 18:00</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Fuseau horaire: Europe/Zurich
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                <Button 
                  variant="default"
                  onClick={() => window.open("mailto:support@lyta.ch?subject=Question technique", "_blank")}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Poser une question
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.open("mailto:support@lyta.ch?subject=Signaler un bug", "_blank")}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Signaler un bug
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Types de demandes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium text-sm mb-1">🐛 Bugs & Problèmes</h4>
                  <p className="text-xs text-muted-foreground">
                    Dysfonctionnements, erreurs, comportements inattendus
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium text-sm mb-1">❓ Questions</h4>
                  <p className="text-xs text-muted-foreground">
                    Utilisation, fonctionnalités, bonnes pratiques
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium text-sm mb-1">🚀 Demandes d'évolution</h4>
                  <p className="text-xs text-muted-foreground">
                    Nouvelles fonctionnalités, améliorations
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium text-sm mb-1">⬆️ Upgrades</h4>
                  <p className="text-xs text-muted-foreground">
                    Changement de plan, ajout de sièges, options
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de déblocage de siège utilisateur */}
      <AddUserSeatDialog
        open={showUnlockSeatDialog}
        onOpenChange={setShowUnlockSeatDialog}
        seatsIncluded={tenantSeats.seatsIncluded}
        activeUsers={tenantSeats.activeUsers}
        seatPrice={tenantSeats.seatPrice}
        onSuccess={handleSeatAdded}
      />
    </div>
  );
}
