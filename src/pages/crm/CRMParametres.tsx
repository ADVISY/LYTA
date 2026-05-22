import { useState, useEffect } from "react";
import type { TFunction } from "i18next";
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
  Users, UserCheck, AlertCircle, Loader2, KeyRound, Mail, Lock,
  CreditCard, Briefcase, MapPin, RefreshCw, FolderOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserTenant } from "@/hooks/useUserTenant";
import { useTenantSeats } from "@/hooks/useTenantSeats";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { invokeSupabaseFunction } from "@/lib/edgeFunctions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RolesManager } from "@/components/crm/settings/RolesManager";
import { TenantSupportTickets } from "@/components/support/TenantSupportTickets";
import { TenantQuotaWidget } from "@/components/quotas/TenantQuotaWidget";
import { UserRolesManager } from "@/components/crm/settings/UserRolesManager";
import { EmailAutomationSettings } from "@/components/crm/settings/EmailAutomationSettings";
import { AddUserSeatDialog } from "@/components/crm/settings/AddUserSeatDialog";
import { CabinetInfoSettings } from "@/components/crm/settings/CabinetInfoSettings";
import { TenantCatalogsTab } from "@/components/crm/settings/TenantCatalogsTab";
import CRMAbonnement from "@/pages/crm/CRMAbonnement";
import type { Tables } from "@/integrations/supabase/types";

type InsuranceCompany = Tables<"insurance_companies">;
type InsuranceProduct = Tables<"insurance_products">;
type ClientRow = Tables<"clients">;
type ProfileRow = Tables<"profiles">;

type CompanyOption = Pick<InsuranceCompany, "id" | "name" | "logo_url">;
type CollaboratorLink = Pick<ClientRow, "id" | "user_id" | "first_name" | "last_name" | "email" | "created_at">;
type CollaboratorOption = Pick<ClientRow, "id" | "first_name" | "last_name" | "email">;
type UserProfile = Pick<ProfileRow, "id" | "email" | "first_name" | "last_name">;
type ClientProfile = Pick<ProfileRow, "id" | "email">;
type CollaboratorAccountRow = Pick<
  ClientRow,
  "id" | "first_name" | "last_name" | "email" | "mobile" | "profession" | "status" | "user_id" | "created_at"
>;
type ClientAccountRow = Pick<
  ClientRow,
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "user_id"
  | "created_at"
  | "status"
  | "company_name"
  | "mobile"
  | "phone"
  | "address"
  | "city"
  | "zip_code"
  | "postal_code"
>;

interface ProductOption extends Pick<InsuranceProduct, "id" | "name" | "category" | "company_id" | "description"> {
  company?: { name: string } | null;
}

interface TenantRoleAssignmentAccountRow {
  id: string;
  user_id: string;
  assigned_at: string;
  tenant_roles: { name: string | null } | { name: string | null }[] | null;
}

interface UserAccount {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles: UserProfile | null;
  roles: string[];
  collaborateur: CollaboratorLink | null;
  isIncomplete: boolean;
}

interface UserAccessTarget {
  userId: string;
  name: string;
  email: string | null;
  collaborateurId?: string;
}

interface ClientAddress extends ClientAccountRow {
  profile: ClientProfile | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

// Couleurs disponibles pour le thème - needs to be inside component to use translations
const getThemeColors = (t: TFunction) => [
  { id: "blue", label: t('settings.blue'), color: "hsl(221, 83%, 53%)", class: "bg-blue-600" },
  { id: "violet", label: t('settings.violet'), color: "hsl(262, 83%, 58%)", class: "bg-violet-600" },
  { id: "green", label: t('settings.green'), color: "hsl(142, 76%, 36%)", class: "bg-green-600" },
  { id: "orange", label: t('settings.orange'), color: "hsl(24, 95%, 53%)", class: "bg-orange-500" },
  { id: "red", label: t('settings.red'), color: "hsl(0, 84%, 60%)", class: "bg-red-500" },
  { id: "pink", label: t('settings.pink'), color: "hsl(330, 81%, 60%)", class: "bg-pink-500" },
  { id: "teal", label: t('settings.teal'), color: "hsl(173, 80%, 40%)", class: "bg-teal-500" },
  { id: "indigo", label: t('settings.indigo'), color: "hsl(239, 84%, 67%)", class: "bg-indigo-500" },
];

const getRoleLabels = (t: TFunction): Record<string, string> => ({
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

const STAFF_ROLES = new Set(["admin", "manager", "agent", "backoffice", "compta", "partner"]);

function normalizeRoleName(roleName: string): string {
  const normalized = roleName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (["admin cabinet", "administrateur", "admin"].includes(normalized)) return "admin";
  if (normalized === "manager") return "manager";
  if (normalized === "agent") return "agent";
  if (["back-office", "backoffice", "back office"].includes(normalized)) return "backoffice";
  if (["comptabilite", "compta"].includes(normalized)) return "compta";
  if (["partenaire", "partner"].includes(normalized)) return "partner";

  return roleName;
}

function getTenantRoleName(assignment: TenantRoleAssignmentAccountRow): string | null {
  if (Array.isArray(assignment.tenant_roles)) {
    return assignment.tenant_roles[0]?.name ?? null;
  }

  return assignment.tenant_roles?.name ?? null;
}

export default function CRMParametres() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tenantId } = useUserTenant();
  const tenantSeats = useTenantSeats();
  const { role } = useUserRole();
  const { can, isAdmin: hasTenantAdminRole, isLoading: permissionsLoading } = usePermissions();
  
  // Check URL params for tab selection (e.g., ?tab=abonnement)
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || "profil");
  const [showUnlockSeatDialog, setShowUnlockSeatDialog] = useState(false);
  
  const isAdmin = role === "admin";
  const canManageAdminSettings = isAdmin || hasTenantAdminRole || can("settings", "update");
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
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", logo_url: "" });
  const [editingCompany, setEditingCompany] = useState<CompanyOption | null>(null);

  // Produits
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", category: "", company_id: "", description: "" });
  const [editingProduct, setEditingProduct] = useState<ProductOption | null>(null);

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
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [clientAddresses, setClientAddresses] = useState<ClientAddress[]>([]);
  const [collaboratorRows, setCollaboratorRows] = useState<CollaboratorAccountRow[]>([]);
  const [collaborateurs, setCollaborateurs] = useState<CollaboratorOption[]>([]);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountSubTab, setAccountSubTab] = useState<"utilisateurs" | "collaborateurs" | "adresses">("utilisateurs");
  const [newAccount, setNewAccount] = useState({
    email: "",
    role: "agent",
    collaborateurId: "",
  });
  
  // État pour suppression/reset du compte client
  const [deletingUserAccountId, setDeletingUserAccountId] = useState<string | null>(null);
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState<string | null>(null);
  const [confirmDeleteUserDialog, setConfirmDeleteUserDialog] = useState(false);
  const [userAccessToDelete, setUserAccessToDelete] = useState<UserAccessTarget | null>(null);
  const [deletingClientAccountId, setDeletingClientAccountId] = useState<string | null>(null);
  const [resettingPasswordClientId, setResettingPasswordClientId] = useState<string | null>(null);
  const [confirmDeleteClientDialog, setConfirmDeleteClientDialog] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientAddress | null>(null);

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
  // These loaders intentionally refresh when auth or tenant context changes.
  useEffect(() => {
    loadProfile();
    loadCompanies();
    loadProducts();
    loadSettings();
    if (tenantId) {
      loadUserAccounts();
      loadCollaborateurs();
      loadClientAddresses();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tenantId]);

  useEffect(() => {
    if (permissionsLoading || canManageAdminSettings) return;

    const allowedTabs = new Set(["profil", "support"]);
    if (!allowedTabs.has(activeTab)) {
      setActiveTab("profil");
    }
  }, [activeTab, canManageAdminSettings, permissionsLoading]);

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
    if (data) setCompanies(data as CompanyOption[]);
  };

  const loadProducts = async () => {
    const { data } = await supabase
      .from("insurance_products")
      .select("*, company:insurance_companies(name)")
      .order("name");
    if (data) setProducts(data as ProductOption[]);
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

    const [{ data: tenantUsers, error: tenantError }, { data: linkedCollabs, error: collabsError }] =
      await Promise.all([
        supabase
          .from("user_tenant_assignments")
          .select("user_id")
          .eq("tenant_id", tenantId),
        supabase
          .from("clients")
          .select("id, user_id, first_name, last_name, email, created_at")
          .eq("type_adresse", "collaborateur")
          .eq("tenant_id", tenantId)
          .not("user_id", "is", null),
      ]);

    if (tenantError) {
      console.error("Error loading tenant users:", tenantError);
    }

    if (collabsError) {
      console.error("Error loading linked collaborators:", collabsError);
    }

    const collabMap = new Map<string, CollaboratorLink>();
    (linkedCollabs as CollaboratorLink[] | null)?.forEach((collaborateur) => {
      if (collaborateur.user_id) {
        collabMap.set(collaborateur.user_id, collaborateur);
      }
    });

    const allUserIds = Array.from(new Set([
      ...(tenantUsers
        ?.map((tenantUser) => tenantUser.user_id)
        .filter((userId): userId is string => Boolean(userId)) || []),
      ...Array.from(collabMap.keys()),
    ]));

    if (allUserIds.length === 0) {
      setUserAccounts([]);
      return;
    }

    const [{ data: roleAssignments, error: rolesError }, { data: profiles, error: profilesError }] =
      await Promise.all([
        supabase
          .from("user_tenant_roles")
          .select(`
            id,
            user_id,
            assigned_at,
            tenant_roles (
              name
            )
          `)
          .eq("tenant_id", tenantId)
          .in("user_id", allUserIds)
          .order("assigned_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, email, first_name, last_name")
          .in("id", allUserIds),
      ]);

    if (rolesError) {
      console.error("Error loading user accounts:", rolesError);
    }

    if (profilesError) {
      console.error("Error loading user profiles:", profilesError);
    }

    const profileMap = new Map<string, UserProfile>();
    (profiles as UserProfile[] | null)?.forEach((profileItem) => {
      profileMap.set(profileItem.id, profileItem);
    });

    // Group tenant roles by user_id to avoid duplicate entries
    const userMap = new Map<string, UserAccount>();
    (roleAssignments as TenantRoleAssignmentAccountRow[] | null)?.forEach((assignment) => {
      const roleName = getTenantRoleName(assignment);
      if (!roleName) return;

      const roleKey = normalizeRoleName(roleName);
      if (!STAFF_ROLES.has(roleKey) && roleKey === roleName) return;

      const userId = assignment.user_id;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          id: assignment.id,
          user_id: userId,
          role: roleKey,
          created_at: assignment.assigned_at,
          roles: [roleKey],
          profiles: profileMap.get(userId) || null,
          collaborateur: collabMap.get(userId) || null,
          isIncomplete: false,
        });
      } else {
        const existing = userMap.get(userId);
        if (existing && !existing.roles.includes(roleKey)) {
          existing.roles.push(roleKey);
        }
      }
    });

    collabMap.forEach((collaborateur, userId) => {
      if (userMap.has(userId)) return;

      userMap.set(userId, {
        id: collaborateur.id,
        user_id: userId,
        role: "",
        created_at: collaborateur.created_at,
        profiles: profileMap.get(userId) || {
          id: userId,
          email: collaborateur.email || "",
          first_name: collaborateur.first_name,
          last_name: collaborateur.last_name,
        },
        roles: [],
        collaborateur,
        isIncomplete: true,
      });
    });

    const accounts = Array.from(userMap.values()).sort((a, b) => {
      if (a.isIncomplete !== b.isIncomplete) return a.isIncomplete ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setUserAccounts(accounts);
  };

  const loadCollaborateurs = async () => {
    if (!tenantId) return;
    
    const { data, error } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, mobile, profession, status, user_id, created_at")
      .eq("type_adresse", "collaborateur")
      .eq("tenant_id", tenantId)
      .order("last_name");

    if (error) {
      console.error("Error loading collaborators:", error);
      return;
    }
    
    const rows = (data || []) as CollaboratorAccountRow[];
    setCollaboratorRows(rows);
    setCollaborateurs(rows.filter((collaborateur) => !collaborateur.user_id));
  };

  const loadClientAddresses = async () => {
    if (!tenantId) return;

    const { data, error } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, user_id, created_at, status, company_name, mobile, phone, address, city, zip_code, postal_code")
      .eq("type_adresse", "client")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading client addresses:", error);
      return;
    }

    if (data && data.length > 0) {
      const userIds = data
        .map((client) => client.user_id)
        .filter((userId): userId is string => Boolean(userId));
      const { data: profiles } = userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, email")
            .in("id", userIds)
        : { data: [] };

      const profileMap = new Map<string, ClientProfile>();
      (profiles as ClientProfile[] | null)?.forEach((profileItem) => {
        profileMap.set(profileItem.id, profileItem);
      });

      const clientsWithProfiles: ClientAddress[] = (data as ClientAccountRow[]).map((client) => ({
        ...client,
        profile: client.user_id ? profileMap.get(client.user_id) || null : null,
      }));

      setClientAddresses(clientsWithProfiles);
    } else {
      setClientAddresses([]);
    }
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

    // .select() après update pour vérifier qu'une ligne a réellement été touchée.
    // Sans ça, un RLS qui bloque silencieusement retourne error=null + 0 lignes
    // → on affichait à tort "Profil mis à jour" alors que rien ne changeait.
    const { data, error } = await supabase
      .from("profiles")
      .update({
        first_name: profile.firstName,
        last_name: profile.lastName,
        phone: profile.phone,
      })
      .eq("id", user.id)
      .select("id");

    if (error) {
      console.error("[Profile update] Supabase error:", error);
      toast.error(t('settings.profileUpdateError'));
      return;
    }
    if (!data || data.length === 0) {
      // Aucune ligne mise à jour : soit la ligne profiles n'existe pas pour
      // cet utilisateur, soit RLS bloque. On tente un upsert défensif.
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            first_name: profile.firstName,
            last_name: profile.lastName,
            phone: profile.phone,
            email: profile.email,
          },
          { onConflict: "id" }
        );
      if (upsertError) {
        console.error("[Profile upsert fallback] Supabase error:", upsertError);
        toast.error(t('settings.profileUpdateError'));
        return;
      }
    }
    toast.success(t('settings.profileUpdated'));
    setIsEditingProfile(false);
    await loadProfile();
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
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAccount.email.trim())) {
      toast.error(t('settings.invalidEmail') || "Format d'email invalide");
      return;
    }
    if (!newAccount.collaborateurId) {
      toast.error(t('settings.selectCollaborator'));
      return;
    }

    setIsCreatingAccount(true);

    try {
      const selectedCollab = collaborateurs.find(c => c.id === newAccount.collaborateurId);
      
      await invokeSupabaseFunction("create-user-account", {
        body: {
          email: newAccount.email,
          role: newAccount.role,
          collaborateurId: newAccount.collaborateurId,
          firstName: selectedCollab?.first_name,
          lastName: selectedCollab?.last_name,
          tenantId,
        },
      });

      toast.success(t('settings.accountCreated'));
      setIsAddingAccount(false);
      setNewAccount({
        email: "",
        role: "agent",
        collaborateurId: "",
      });
      loadUserAccounts();
      loadCollaborateurs();
      tenantSeats.refresh();
    } catch (error: unknown) {
      console.error("Error creating account:", error);
      toast.error(getErrorMessage(error, t('settings.accountCreationError')));
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const getUserAccountName = (account: UserAccount): string => {
    const name = [
      account.profiles?.first_name || account.collaborateur?.first_name,
      account.profiles?.last_name || account.collaborateur?.last_name,
    ].filter(Boolean).join(" ");

    return name || account.profiles?.email || account.collaborateur?.email || "Utilisateur";
  };

  const getUserAccountEmail = (account: UserAccount): string | null => (
    account.profiles?.email || account.collaborateur?.email || null
  );

  const getUserAccessTargetFromAccount = (account: UserAccount): UserAccessTarget => ({
    userId: account.user_id,
    name: getUserAccountName(account),
    email: getUserAccountEmail(account),
    collaborateurId: account.collaborateur?.id,
  });

  const getUserAccessTargetFromCollaborator = (collaborateur: CollaboratorAccountRow): UserAccessTarget | null => {
    if (!collaborateur.user_id) return null;

    return {
      userId: collaborateur.user_id,
      name: [collaborateur.first_name, collaborateur.last_name].filter(Boolean).join(" ") || collaborateur.email || "Collaborateur",
      email: collaborateur.email,
      collaborateurId: collaborateur.id,
    };
  };

  const handleResendUserInvitation = async (target: UserAccessTarget) => {
    if (!target.email) {
      toast.error("Aucun email trouvé pour cet utilisateur");
      return;
    }

    setResettingPasswordUserId(target.userId);
    try {
      await invokeSupabaseFunction("send-password-reset", {
        body: {
          email: target.email,
          redirectUrl: `${window.location.origin}/reset-password?space=team`,
        },
      });

      toast.success("Lien d'invitation renvoyé");
    } catch (error: unknown) {
      console.error("Error resending user invitation:", error);
      toast.error(getErrorMessage(error, t('common.error')));
    } finally {
      setResettingPasswordUserId(null);
    }
  };

  const handleDeleteUserAccount = async (target: UserAccessTarget) => {
    setDeletingUserAccountId(target.userId);
    try {
      await invokeSupabaseFunction("delete-user-account", {
        body: {
          userId: target.userId,
          collaborateurId: target.collaborateurId,
          accountType: "collaborateur",
          tenantId,
        },
      });

      toast.success("Accès utilisateur supprimé");
      setConfirmDeleteUserDialog(false);
      setUserAccessToDelete(null);
      loadUserAccounts();
      loadCollaborateurs();
      tenantSeats.refresh();
    } catch (error: unknown) {
      console.error("Error deleting user account:", error);
      toast.error(getErrorMessage(error, t('common.error')));
    } finally {
      setDeletingUserAccountId(null);
    }
  };

  // Supprimer le compte client (retirer user_id et supprimer l'utilisateur auth)
  const handleDeleteClientAccount = async (client: ClientAddress) => {
    setDeletingClientAccountId(client.id);
    try {
      await invokeSupabaseFunction("delete-user-account", {
        body: {
          userId: client.user_id,
          clientId: client.id,
          accountType: "client",
          tenantId,
        },
      });

      toast.success(t('settings.clientAccountDeleted'));
      setConfirmDeleteClientDialog(false);
      setClientToDelete(null);
      loadClientAddresses();
    } catch (error: unknown) {
      console.error("Error deleting client account:", error);
      toast.error(getErrorMessage(error, t('common.error')));
    } finally {
      setDeletingClientAccountId(null);
    }
  };

  // Renvoyer un nouveau mot de passe au client
  const handleResendPassword = async (client: ClientAddress) => {
    const clientEmail = client.profile?.email || client.email;
    if (!clientEmail) {
      toast.error(t('settings.noEmailForClient') || "Aucun email trouvé pour ce client");
      return;
    }

    setResettingPasswordClientId(client.id);
    try {

      // Appeler l'edge function pour renvoyer un lien de mot de passe
      await invokeSupabaseFunction('send-password-reset', {
        body: {
          email: clientEmail,
          redirectUrl: `${window.location.origin}/reset-password?space=client`,
        },
      });

      toast.success(t('settings.passwordResent'));
    } catch (error: unknown) {
      console.error("Error resending password:", error);
      toast.error(getErrorMessage(error, t('common.error')));
    } finally {
      setResettingPasswordClientId(null);
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
        <div className="w-full overflow-x-auto pb-2">
          <TabsList className="inline-flex gap-1 h-auto min-w-max">
            <TabsTrigger value="profil" className="gap-2 whitespace-nowrap">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{t('settings.profile')}</span>
            </TabsTrigger>
            {canManageAdminSettings && (
              <TabsTrigger value="abonnement" className="gap-2 whitespace-nowrap">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">{t('subscription.title')}</span>
              </TabsTrigger>
            )}
            {canManageAdminSettings && (
              <>
                <TabsTrigger value="comptes" className="gap-2 whitespace-nowrap">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('settings.accounts')}</span>
                </TabsTrigger>
                <TabsTrigger value="roles" className="gap-2 whitespace-nowrap">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('settings.roles')}</span>
                </TabsTrigger>
                <TabsTrigger value="utilisateurs" className="gap-2 whitespace-nowrap">
                  <KeyRound className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('collaborators.permissions')}</span>
                </TabsTrigger>
                <TabsTrigger value="catalogues" className="gap-2 whitespace-nowrap">
                  <FolderOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Catalogues</span>
                </TabsTrigger>
                <TabsTrigger value="apparence" className="gap-2 whitespace-nowrap">
                  <Palette className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('settings.appearance')}</span>
                </TabsTrigger>
                <TabsTrigger value="emails" className="gap-2 whitespace-nowrap">
                  <Mail className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('emails.title')}</span>
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="support" className="gap-2 whitespace-nowrap">
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.support')}</span>
            </TabsTrigger>
          </TabsList>
        </div>

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

          {/* Cabinet Info - Admin only */}
          {canManageAdminSettings && <CabinetInfoSettings />}
        </TabsContent>

        {/* ABONNEMENT - Admin only */}
        {canManageAdminSettings && (
          <TabsContent value="abonnement" className="space-y-6 mt-6">
            <TenantQuotaWidget />
            <CRMAbonnement />
          </TabsContent>
        )}

        {/* GESTION DES COMPTES */}
        {canManageAdminSettings && (
        <TabsContent value="comptes" className="space-y-6 mt-6">
          <div className="flex gap-2 border-b pb-2 flex-wrap">
            <Button
              variant={accountSubTab === "utilisateurs" ? "default" : "outline"}
              size="sm"
              onClick={() => setAccountSubTab("utilisateurs")}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              {t('settings.users')}
              <Badge variant="secondary" className="ml-1">{userAccounts.length}</Badge>
            </Button>
            <Button
              variant={accountSubTab === "collaborateurs" ? "default" : "outline"}
              size="sm"
              onClick={() => setAccountSubTab("collaborateurs")}
              className="gap-2"
            >
              <Briefcase className="h-4 w-4" />
              {t('nav.collaborators')}
              <Badge variant="secondary" className="ml-1">{collaboratorRows.length}</Badge>
            </Button>
            <Button
              variant={accountSubTab === "adresses" ? "default" : "outline"}
              size="sm"
              onClick={() => setAccountSubTab("adresses")}
              className="gap-2"
            >
              <MapPin className="h-4 w-4" />
              {t('nav.clients')}
              <Badge variant="secondary" className="ml-1">{clientAddresses.length}</Badge>
            </Button>
          </div>

          {/* SOUS-ONGLET UTILISATEURS */}
          {accountSubTab === "utilisateurs" && (
            <>
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
                  Les utilisateurs sont les collaborateurs qui disposent d'un accès CRM. Les comptes client des adresses restent gratuits et sont visibles dans l'onglet Adresses.
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
                        <TableHead className="text-right">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userAccounts.map(account => (
                        <TableRow key={account.user_id}>
                          <TableCell>
                            <span className="font-medium">
                              {account.profiles?.first_name || account.collaborateur?.first_name}{" "}
                              {account.profiles?.last_name || account.collaborateur?.last_name}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {account.profiles?.email || account.collaborateur?.email || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {account.roles.length > 0 ? (
                                account.roles.map((role: string) => (
                                  <Badge key={role} className={cn("text-white", roleBadgeColors[role] || "bg-gray-500")}>
                                    {roleLabels[role] || role}
                                  </Badge>
                                ))
                              ) : (
                                <Badge variant="outline" className="border-amber-300 text-amber-700">
                                  Compte a reparer
                                </Badge>
                              )}
                            </div>
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
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Renvoyer le lien"
                                onClick={() => handleResendUserInvitation(getUserAccessTargetFromAccount(account))}
                                disabled={resettingPasswordUserId === account.user_id}
                              >
                                {resettingPasswordUserId === account.user_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                title="Supprimer l'accès"
                                onClick={() => {
                                  setUserAccessToDelete(getUserAccessTargetFromAccount(account));
                                  setConfirmDeleteUserDialog(true);
                                }}
                                disabled={account.user_id === user?.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {userAccounts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Aucun utilisateur CRM dans ce cabinet
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
            </>
          )}

          {/* SOUS-ONGLET COLLABORATEURS */}
          {accountSubTab === "collaborateurs" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    {t('nav.collaborators')}
                  </CardTitle>
                  <Badge variant="outline">{collaboratorRows.length} total</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('nav.collaborators')}</TableHead>
                      <TableHead>{t('common.email')}</TableHead>
                      <TableHead>{t('collaborators.function')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>Accès CRM</TableHead>
                      <TableHead>{t('settings.createdAt')}</TableHead>
                      <TableHead className="text-right">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collaboratorRows.map((collaborateur) => (
                      <TableRow key={collaborateur.id}>
                        <TableCell>
                          <span className="font-medium">
                            {[collaborateur.first_name, collaborateur.last_name].filter(Boolean).join(" ") || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {collaborateur.email || "-"}
                        </TableCell>
                        <TableCell>
                          {collaborateur.profession ? (roleLabels[collaborateur.profession] || collaborateur.profession) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={collaborateur.status === "actif" ? "default" : "secondary"}>
                            {collaborateur.status || "actif"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {collaborateur.user_id ? (
                            <Badge className="bg-emerald-600 text-white">Utilisateur lie</Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-300 text-amber-700">Sans accès</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(collaborateur.created_at).toLocaleDateString("fr-CH")}
                        </TableCell>
                        <TableCell className="text-right">
                          {collaborateur.user_id ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Renvoyer le lien"
                                onClick={() => {
                                  const target = getUserAccessTargetFromCollaborator(collaborateur);
                                  if (target) handleResendUserInvitation(target);
                                }}
                                disabled={resettingPasswordUserId === collaborateur.user_id}
                              >
                                {resettingPasswordUserId === collaborateur.user_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                title="Supprimer l'accès"
                                onClick={() => {
                                  const target = getUserAccessTargetFromCollaborator(collaborateur);
                                  if (target) {
                                    setUserAccessToDelete(target);
                                    setConfirmDeleteUserDialog(true);
                                  }
                                }}
                                disabled={collaborateur.user_id === user?.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {collaboratorRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Aucun collaborateur trouvé
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* SOUS-ONGLET ADRESSES */}
          {accountSubTab === "adresses" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {t('clients.addresses')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('clients.nameCompany')}</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>{t('clients.addresses')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>Compte client</TableHead>
                      <TableHead>{t('settings.createdAt')}</TableHead>
                      <TableHead className="text-right">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientAddresses.map(client => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <span className="font-medium">
                            {client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="space-y-1 text-sm">
                            <div>{client.profile?.email || client.email || "-"}</div>
                            {(client.mobile || client.phone) && (
                              <div>{client.mobile || client.phone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="space-y-1 text-sm">
                            {client.address && <div>{client.address}</div>}
                            <div>{[client.zip_code || client.postal_code, client.city].filter(Boolean).join(" ") || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={client.status === 'actif' ? 'default' : 'secondary'}>
                            {client.status || 'actif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {client.user_id ? (
                            <Badge className="bg-emerald-600 text-white">Compte actif</Badge>
                          ) : (
                            <Badge variant="outline">Sans compte</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(client.created_at).toLocaleDateString("fr-CH")}
                        </TableCell>
                        <TableCell className="text-right">
                          {client.user_id ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                title={t('settings.resendPassword')}
                                onClick={() => handleResendPassword(client)}
                                disabled={resettingPasswordClientId === client.id}
                              >
                                {resettingPasswordClientId === client.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Mail className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                title={t('settings.deleteAccount')}
                                onClick={() => {
                                  setClientToDelete(client);
                                  setConfirmDeleteClientDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {clientAddresses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Aucune adresse trouvée
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Dialog open={confirmDeleteUserDialog} onOpenChange={setConfirmDeleteUserDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Supprimer cet accès utilisateur ?</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Voulez-vous vraiment supprimer l'accès CRM de {userAccessToDelete?.name} ?
                  Le collaborateur ne pourra plus se connecter à ce cabinet.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setConfirmDeleteUserDialog(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => userAccessToDelete && handleDeleteUserAccount(userAccessToDelete)}
                    disabled={deletingUserAccountId === userAccessToDelete?.userId}
                  >
                    {deletingUserAccountId === userAccessToDelete?.userId ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('common.deleting')}
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('common.delete')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog de confirmation de suppression */}
          <Dialog open={confirmDeleteClientDialog} onOpenChange={setConfirmDeleteClientDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('settings.confirmDeleteAccount')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  {t('settings.deleteAccountWarning', { name: `${clientToDelete?.first_name} ${clientToDelete?.last_name}` })}
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setConfirmDeleteClientDialog(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => clientToDelete && handleDeleteClientAccount(clientToDelete)}
                    disabled={deletingClientAccountId === clientToDelete?.id}
                  >
                    {deletingClientAccountId === clientToDelete?.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('common.deleting')}
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('common.delete')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
        )}

        {/* RÔLES */}
        {canManageAdminSettings && (
        <TabsContent value="roles" className="space-y-6 mt-6">
          <RolesManager />
        </TabsContent>
        )}

        {/* UTILISATEURS & PERMISSIONS */}
        {canManageAdminSettings && (
        <TabsContent value="utilisateurs" className="space-y-6 mt-6">
          <UserRolesManager />
        </TabsContent>
        )}

        {/* COMPAGNIES */}
        {canManageAdminSettings && (
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
        )}

        {/* PRODUITS */}
        {canManageAdminSettings && (
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
                      <Label>{t('settingsExtended.category')}</Label>
                      <Select 
                        value={newProduct.category}
                        onValueChange={(v) => setNewProduct({ ...newProduct, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('settingsExtended.selectPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {productCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('settingsExtended.descriptionOptional')}</Label>
                      <Input 
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddProduct}>{t('settingsExtended.add')}</Button>
                    <Button size="sm" variant="outline" onClick={() => setIsAddingProduct(false)}>{t('common.cancel')}</Button>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('settingsExtended.name')}</TableHead>
                    <TableHead>{t('settingsExtended.company')}</TableHead>
                    <TableHead>{t('settingsExtended.category')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
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
                  {t('settingsExtended.productsDisplayCount', { count: products.length })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Dialog d'édition produit */}
          <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('settingsExtended.editProduct')}</DialogTitle>
              </DialogHeader>
              {editingProduct && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('settingsExtended.name')}</Label>
                    <Input 
                      value={editingProduct.name}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('settingsExtended.company')}</Label>
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
                    <Label>{t('settingsExtended.category')}</Label>
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
                    <Button onClick={handleUpdateProduct}>{t('common.save')}</Button>
                    <Button variant="outline" onClick={() => setEditingProduct(null)}>{t('common.cancel')}</Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
        )}

        {/* COMMISSIONS */}
        {canManageAdminSettings && (
        <TabsContent value="commissions" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('settingsExtended.commissionRates')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">{t('settingsExtended.agentRates')}</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{t('settingsExtended.lcaCommission')}</Label>
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
                      <Label>{t('settingsExtended.vieCommission')}</Label>
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
                  <h4 className="font-medium">{t('settingsExtended.managerRates')}</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{t('settingsExtended.managerLcaShare')}</Label>
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
                      <Label>{t('settingsExtended.managerVieShare')}</Label>
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
                  <Label>{t('settingsExtended.defaultReserveRate')}</Label>
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
                {t('settingsExtended.saveRates')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* CATALOGUES (types de documents + services facturables) */}
        {canManageAdminSettings && (
          <TabsContent value="catalogues" className="space-y-6 mt-6">
            <TenantCatalogsTab />
          </TabsContent>
        )}

        {/* APPARENCE */}
        {canManageAdminSettings && (
        <TabsContent value="apparence" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('settingsExtended.themeSection')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isDarkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  <div>
                    <p className="font-medium">{t('settingsExtended.darkModeToggle')}</p>
                    <p className="text-sm text-muted-foreground">{t('settingsExtended.darkModeDescription')}</p>
                  </div>
                </div>
                <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('settingsExtended.primaryColor')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                {themeColors.map(color => (
                  <button
                    key={color.id}
                    onClick={() => {
                      setSelectedColor(color.id);
                      toast.success(t('settingsExtended.colorSelected', { name: color.label }));
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
                {t('settingsExtended.colorChangeNote')}
              </p>
              <Button className="mt-4" onClick={saveSettings}>
                <Save className="h-4 w-4 mr-2" />
                {t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* EMAILS */}
        {canManageAdminSettings && (
        <TabsContent value="emails" className="space-y-6 mt-6">
          <EmailAutomationSettings />
        </TabsContent>
        )}

        {/* SUPPORT */}
        <TabsContent value="support" className="space-y-6 mt-6">
          {/* Nouveau système de tickets intégré */}
          <TenantSupportTickets />

          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                {t('settingsExtended.supportTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {t('settingsExtended.supportDescription')}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 p-4 bg-background rounded-lg border">
                  <h4 className="font-medium mb-2">{t('settingsExtended.supportEmail')}</h4>
                  <a 
                    href="mailto:support@lyta.ch"
                    className="text-lg font-mono text-primary hover:underline"
                  >
                    support@lyta.ch
                  </a>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('settingsExtended.responseTime')}
                  </p>
                </div>
                
                <div className="flex-1 p-4 bg-background rounded-lg border">
                  <h4 className="font-medium mb-2">{t('settingsExtended.hours')}</h4>
                  <p className="text-sm">{t('settingsExtended.mondayFriday')}</p>
                  <p className="text-lg font-medium">09:00 - 18:00</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('settingsExtended.timezone')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                <Button 
                  variant="default"
                  onClick={() => window.open("mailto:support@lyta.ch?subject=Question technique", "_blank")}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {t('settingsExtended.askQuestion')}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.open("mailto:support@lyta.ch?subject=Signaler un bug", "_blank")}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {t('settingsExtended.reportBug')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settingsExtended.requestTypes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium text-sm mb-1">{t('settingsExtended.bugsProblems')}</h4>
                  <p className="text-xs text-muted-foreground">
                    {t('settingsExtended.bugsDesc')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium text-sm mb-1">{t('settingsExtended.questions')}</h4>
                  <p className="text-xs text-muted-foreground">
                    {t('settingsExtended.questionsDesc')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium text-sm mb-1">{t('settingsExtended.evolutionRequests')}</h4>
                  <p className="text-xs text-muted-foreground">
                    {t('settingsExtended.evolutionDesc')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium text-sm mb-1">{t('settingsExtended.upgrades')}</h4>
                  <p className="text-xs text-muted-foreground">
                    {t('settingsExtended.upgradesDesc')}
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
