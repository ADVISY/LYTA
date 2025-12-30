import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  Building2, 
  Palette, 
  Shield, 
  User, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Wand2,
  Crown,
  Upload,
  Mail,
  Plus,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TenantFormData {
  // Step 1 - Info cabinet
  name: string;
  legal_name: string;
  email: string;
  phone: string;
  address: string;
  slug: string;
  status: "test" | "active" | "suspended";
  contract_notification_emails: string[];
  
  // Step 2 - Branding
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  display_name: string;
  
  // Step 3 - Security
  enable_2fa_login: boolean;
  enable_2fa_contract: boolean;
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_number: boolean;
  password_require_special: boolean;
  
  // Step 4 - Admin
  admin_first_name: string;
  admin_last_name: string;
  admin_email: string;
  admin_phone: string;
  admin_language: string;
}

const initialFormData: TenantFormData = {
  name: "",
  legal_name: "",
  email: "",
  phone: "",
  address: "",
  slug: "",
  status: "test",
  contract_notification_emails: [],
  logo_url: "",
  primary_color: "#0066FF",
  secondary_color: "#1a1a2e",
  display_name: "",
  enable_2fa_login: false,
  enable_2fa_contract: false,
  password_min_length: 8,
  password_require_uppercase: true,
  password_require_number: true,
  password_require_special: true,
  admin_first_name: "",
  admin_last_name: "",
  admin_email: "",
  admin_phone: "",
  admin_language: "fr",
};

const steps = [
  { id: 1, name: "Cabinet", icon: Building2, description: "Informations du cabinet" },
  { id: 2, name: "Branding", icon: Palette, description: "Personnalisation visuelle" },
  { id: 3, name: "Sécurité", icon: Shield, description: "Paramètres de sécurité" },
  { id: 4, name: "Admin", icon: User, description: "Créer l'administrateur" },
  { id: 5, name: "Finalisation", icon: CheckCircle2, description: "Récapitulatif" },
];

export default function KingWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<TenantFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const updateFormData = (field: keyof TenantFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (name: string) => {
    updateFormData("name", name);
    if (!formData.slug || formData.slug === generateSlug(formData.name)) {
      updateFormData("slug", generateSlug(name));
    }
    if (!formData.display_name) {
      updateFormData("display_name", name);
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name || !formData.email || !formData.slug) {
          toast.error("Veuillez remplir les champs obligatoires");
          return false;
        }
        // Validate slug format
        if (!/^[a-z0-9-]+$/.test(formData.slug)) {
          toast.error("Le slug ne doit contenir que des lettres minuscules, chiffres et tirets");
          return false;
        }
        return true;
      case 2:
        return true; // Branding is optional
      case 3:
        return true; // Security has defaults
      case 4:
        if (!formData.admin_first_name || !formData.admin_last_name || !formData.admin_email) {
          toast.error("Veuillez remplir les informations de l'administrateur");
          return false;
        }
        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
          toast.error("Veuillez entrer un email valide pour l'administrateur");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // 1. Create tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: formData.name,
          legal_name: formData.legal_name || null,
          email: formData.email,
          phone: formData.phone || null,
          address: formData.address || null,
          slug: formData.slug,
          status: formData.status,
          contract_notification_emails: formData.contract_notification_emails.filter(e => e.trim()),
        })
        .select()
        .single();

      if (tenantError) {
        if (tenantError.code === '23505') {
          toast.error("Ce slug est déjà utilisé par un autre cabinet");
        } else {
          throw tenantError;
        }
        return;
      }

      // 2. Create branding
      await supabase
        .from('tenant_branding')
        .insert({
          tenant_id: tenant.id,
          logo_url: formData.logo_url || null,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          display_name: formData.display_name || formData.name,
        });

      // 3. Create security settings
      await supabase
        .from('tenant_security_settings')
        .insert({
          tenant_id: tenant.id,
          enable_2fa_login: formData.enable_2fa_login,
          enable_2fa_contract: formData.enable_2fa_contract,
          password_min_length: formData.password_min_length,
          password_require_uppercase: formData.password_require_uppercase,
          password_require_number: formData.password_require_number,
          password_require_special: formData.password_require_special,
        });

      // 4. Create admin user via edge function
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const response = await supabase.functions.invoke('create-tenant-admin', {
          body: {
            tenant_id: tenant.id,
            email: formData.admin_email,
            first_name: formData.admin_first_name,
            last_name: formData.admin_last_name,
            phone: formData.admin_phone,
            language: formData.admin_language,
          },
        });

        if (response.error) {
          console.error("Error creating admin:", response.error);
          toast.error("Le tenant a été créé mais l'admin n'a pas pu être créé: " + response.error.message);
        } else {
          console.log("Admin created successfully:", response.data);
        }
      } catch (adminError: any) {
        console.error("Error calling edge function:", adminError);
        // Don't fail the whole process, tenant is created
      }
      setIsComplete(true);
      toast.success("Client SaaS créé avec succès!");
      
    } catch (error: any) {
      console.error("Error creating tenant:", error);
      toast.error("Erreur lors de la création du client: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Client créé avec succès!</h2>
            <p className="text-muted-foreground mb-6">
              Le cabinet <strong>{formData.name}</strong> a été créé avec le sous-domaine{" "}
              <strong>{formData.slug}.lyta.ch</strong>
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => navigate('/king/tenants')}>
                Voir les clients
              </Button>
              <Button 
                className="bg-amber-500 hover:bg-amber-600"
                onClick={() => {
                  setFormData(initialFormData);
                  setCurrentStep(1);
                  setIsComplete(false);
                }}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Créer un autre client
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500/10 rounded-lg">
          <Wand2 className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Nouveau Client SaaS</h1>
          <p className="text-muted-foreground">Wizard de création d'un cabinet LYTA</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors",
                currentStep === step.id 
                  ? "bg-amber-500 text-white"
                  : currentStep > step.id
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground"
              )}
              onClick={() => currentStep > step.id && setCurrentStep(step.id)}
            >
              {currentStep > step.id ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <step.icon className="h-5 w-5" />
              )}
              <span className="hidden md:inline font-medium">{step.name}</span>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="h-5 w-5 text-muted-foreground mx-2" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => {
              const StepIcon = steps[currentStep - 1].icon;
              return <StepIcon className="h-5 w-5 text-amber-500" />;
            })()}
            Étape {currentStep} - {steps[currentStep - 1].description}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Cabinet Info */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du cabinet *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Advisy"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_name">Raison sociale</Label>
                <Input
                  id="legal_name"
                  value={formData.legal_name}
                  onChange={(e) => updateFormData("legal_name", e.target.value)}
                  placeholder="Ex: Advisy SA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email principal *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                  placeholder="contact@advisy.ch"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => updateFormData("phone", e.target.value)}
                  placeholder="+41 22 123 45 67"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Adresse</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => updateFormData("address", e.target.value)}
                  placeholder="Rue de la Gare 1, 1003 Lausanne"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (sous-domaine) *</Label>
                <div className="flex">
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => updateFormData("slug", e.target.value.toLowerCase())}
                    placeholder="advisy"
                    className="rounded-r-none"
                  />
                  <span className="inline-flex items-center px-3 bg-muted border border-l-0 rounded-r-md text-sm text-muted-foreground">
                    .lyta.ch
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Statut</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value: "test" | "active" | "suspended") => updateFormData("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="suspended">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Contract notification emails */}
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Emails notification dépôt contrat
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ces adresses recevront un email lors de chaque dépôt de contrat par les collaborateurs
                </p>
                <div className="space-y-2">
                  {formData.contract_notification_emails.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          const newEmails = [...formData.contract_notification_emails];
                          newEmails[index] = e.target.value;
                          updateFormData("contract_notification_emails", newEmails);
                        }}
                        placeholder="backoffice@cabinet.ch"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newEmails = formData.contract_notification_emails.filter((_, i) => i !== index);
                          updateFormData("contract_notification_emails", newEmails);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updateFormData("contract_notification_emails", [...formData.contract_notification_emails, ""]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un email
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Branding */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="logo_url">URL du logo</Label>
                <div className="flex gap-4">
                  <Input
                    id="logo_url"
                    value={formData.logo_url}
                    onChange={(e) => updateFormData("logo_url", e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="flex-1"
                  />
                  <Button variant="outline" disabled>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload (bientôt)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Format recommandé: PNG ou SVG avec fond transparent
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="primary_color">Couleur principale</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => updateFormData("primary_color", e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => updateFormData("primary_color", e.target.value)}
                    placeholder="#0066FF"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary_color">Couleur secondaire</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => updateFormData("secondary_color", e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => updateFormData("secondary_color", e.target.value)}
                    placeholder="#1a1a2e"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="display_name">Nom affiché dans le CRM</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => updateFormData("display_name", e.target.value)}
                  placeholder="Ex: Advisy"
                />
                <p className="text-xs text-muted-foreground">
                  Ce nom apparaîtra dans le header et la page de connexion
                </p>
              </div>
              
              {/* Preview */}
              <div className="md:col-span-2 p-6 border rounded-lg bg-muted/30">
                <p className="text-sm font-medium mb-4">Prévisualisation</p>
                <div 
                  className="flex items-center gap-3 p-4 rounded-lg"
                  style={{ backgroundColor: formData.secondary_color }}
                >
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="Logo" className="h-10 object-contain" />
                  ) : (
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: formData.primary_color }}
                    >
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <span 
                    className="font-semibold text-lg"
                    style={{ color: formData.primary_color }}
                  >
                    {formData.display_name || formData.name || "Nom du cabinet"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Security */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">2FA SMS à la connexion</p>
                      <p className="text-sm text-muted-foreground">
                        Vérification par SMS lors de chaque connexion
                      </p>
                    </div>
                    <Switch
                      checked={formData.enable_2fa_login}
                      onCheckedChange={(checked) => updateFormData("enable_2fa_login", checked)}
                    />
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">2FA SMS dépôt contrat</p>
                      <p className="text-sm text-muted-foreground">
                        Vérification SMS lors du dépôt de contrat
                      </p>
                    </div>
                    <Switch
                      checked={formData.enable_2fa_contract}
                      onCheckedChange={(checked) => updateFormData("enable_2fa_contract", checked)}
                    />
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Politique de mot de passe</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Longueur minimale</Label>
                    <Select 
                      value={String(formData.password_min_length)} 
                      onValueChange={(value) => updateFormData("password_min_length", parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">6 caractères</SelectItem>
                        <SelectItem value="8">8 caractères</SelectItem>
                        <SelectItem value="10">10 caractères</SelectItem>
                        <SelectItem value="12">12 caractères</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">Majuscule requise</p>
                      <Switch
                        checked={formData.password_require_uppercase}
                        onCheckedChange={(checked) => updateFormData("password_require_uppercase", checked)}
                      />
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">Chiffre requis</p>
                      <Switch
                        checked={formData.password_require_number}
                        onCheckedChange={(checked) => updateFormData("password_require_number", checked)}
                      />
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm">Caractère spécial</p>
                      <Switch
                        checked={formData.password_require_special}
                        onCheckedChange={(checked) => updateFormData("password_require_special", checked)}
                      />
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Admin */}
          {currentStep === 4 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-amber-600">
                  <Crown className="h-5 w-5" />
                  <span className="font-medium">Admin Cabinet</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Cet utilisateur sera le propriétaire du cabinet avec tous les droits d'administration
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_first_name">Prénom *</Label>
                <Input
                  id="admin_first_name"
                  value={formData.admin_first_name}
                  onChange={(e) => updateFormData("admin_first_name", e.target.value)}
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_last_name">Nom *</Label>
                <Input
                  id="admin_last_name"
                  value={formData.admin_last_name}
                  onChange={(e) => updateFormData("admin_last_name", e.target.value)}
                  placeholder="Dupont"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_email">Email *</Label>
                <Input
                  id="admin_email"
                  type="email"
                  value={formData.admin_email}
                  onChange={(e) => updateFormData("admin_email", e.target.value)}
                  placeholder="admin@advisy.ch"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_phone">Téléphone (pour 2FA)</Label>
                <Input
                  id="admin_phone"
                  value={formData.admin_phone}
                  onChange={(e) => updateFormData("admin_phone", e.target.value)}
                  placeholder="+41 79 123 45 67"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_language">Langue</Label>
                <Select 
                  value={formData.admin_language} 
                  onValueChange={(value) => updateFormData("admin_language", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="it">Italiano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 5: Summary */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-4">
                  <h3 className="font-medium flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-amber-500" />
                    Cabinet
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Nom:</dt>
                      <dd className="font-medium">{formData.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Sous-domaine:</dt>
                      <dd className="font-medium">{formData.slug}.lyta.ch</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Email:</dt>
                      <dd className="font-medium">{formData.email}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Statut:</dt>
                      <dd className={`font-medium ${
                        formData.status === 'active' ? 'text-emerald-600' : 
                        formData.status === 'test' ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {formData.status}
                      </dd>
                    </div>
                  </dl>
                </Card>

                <Card className="p-4">
                  <h3 className="font-medium flex items-center gap-2 mb-3">
                    <Palette className="h-4 w-4 text-amber-500" />
                    Branding
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <dt className="text-muted-foreground">Couleur principale:</dt>
                      <dd className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: formData.primary_color }}
                        />
                        <span className="font-medium">{formData.primary_color}</span>
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Nom affiché:</dt>
                      <dd className="font-medium">{formData.display_name || formData.name}</dd>
                    </div>
                  </dl>
                </Card>

                <Card className="p-4">
                  <h3 className="font-medium flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4 text-amber-500" />
                    Sécurité
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">2FA connexion:</dt>
                      <dd className={`font-medium ${formData.enable_2fa_login ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {formData.enable_2fa_login ? 'Activé' : 'Désactivé'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">2FA contrat:</dt>
                      <dd className={`font-medium ${formData.enable_2fa_contract ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {formData.enable_2fa_contract ? 'Activé' : 'Désactivé'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Mot de passe:</dt>
                      <dd className="font-medium">{formData.password_min_length}+ caractères</dd>
                    </div>
                  </dl>
                </Card>

                <Card className="p-4">
                  <h3 className="font-medium flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-amber-500" />
                    Admin Cabinet
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Nom:</dt>
                      <dd className="font-medium">{formData.admin_first_name} {formData.admin_last_name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Email:</dt>
                      <dd className="font-medium">{formData.admin_email}</dd>
                    </div>
                    {formData.admin_phone && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Téléphone:</dt>
                        <dd className="font-medium">{formData.admin_phone}</dd>
                      </div>
                    )}
                  </dl>
                </Card>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm">
                  <strong>À la validation :</strong> Le tenant sera créé, les paramètres de branding 
                  et sécurité seront appliqués, et l'admin recevra un email d'invitation pour 
                  activer son compte.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Précédent
        </Button>
        
        {currentStep < 5 ? (
          <Button onClick={nextStep} className="bg-amber-500 hover:bg-amber-600">
            Suivant
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Création en cours...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Créer le client
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
