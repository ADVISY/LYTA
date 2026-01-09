import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, LayoutDashboard, FileUp, User, Users, Crown, Building2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import lytaLogo from "@/assets/lyta-logo-full.svg";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTenant } from "@/contexts/TenantContext";
import { SmsVerificationDialog } from "@/components/auth/SmsVerificationDialog";

type View = "choice" | "client" | "team" | "team-login" | "king";

interface LoginFormProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onResetPassword: () => void;
}

const LoginForm = ({
  title,
  subtitle,
  onBack,
  email,
  setEmail,
  password,
  setPassword,
  loading,
  onSubmit,
  onResetPassword,
}: LoginFormProps) => (
  <div className="space-y-0">
    <div className="flex items-center gap-2 mb-6">
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>

    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.ch"
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={onResetPassword}
        >
          Mot de passe oublié ?
        </button>
      </div>

      <Button 
        type="submit" 
        disabled={loading}
        className="w-full mt-6"
      >
        {loading ? "Chargement..." : "Se connecter"}
      </Button>
    </form>
  </div>
);

interface ChoiceScreenProps {
  onClientClick: () => void;
  onTeamClick: () => void;
  onSuperAdminClick: () => void;
  showSuperAdmin?: boolean;
  isTenantMode?: boolean;
}

const ChoiceScreen = ({ onClientClick, onTeamClick, onSuperAdminClick, showSuperAdmin = true, isTenantMode = false }: ChoiceScreenProps) => (
  <div className="space-y-8">
    <div className="text-center">
      <h2 className="text-xl font-bold text-foreground mb-2">
        {isTenantMode ? "Bienvenue" : "Bienvenue sur LYTA"}
      </h2>
      <p className="text-sm text-muted-foreground">Sélectionnez votre espace</p>
    </div>

    <div className="space-y-4">
      {/* Client Access - Only for tenants */}
      {isTenantMode && (
        <button
          onClick={onClientClick}
          className="w-full flex items-center gap-4 p-6 border-2 rounded-xl hover:border-primary hover:bg-primary/5 transition-all group"
        >
          <div className="p-4 rounded-full bg-blue-500/10 text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
            <User className="h-8 w-8" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-foreground">ESPACE CLIENT</h3>
            <p className="text-sm text-muted-foreground">Accédez à votre espace personnel</p>
          </div>
        </button>
      )}

      {/* Team Access */}
      <button
        onClick={onTeamClick}
        className="w-full flex items-center gap-4 p-6 border-2 rounded-xl hover:border-primary hover:bg-primary/5 transition-all group"
      >
        <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
          <Users className="h-8 w-8" />
        </div>
        <div className="text-left">
          <h3 className="text-lg font-bold text-foreground">
            {isTenantMode ? "ESPACE TEAM" : "MEMBRE LYTA"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isTenantMode ? "CRM & Gestion des contrats" : "Support & Développement"}
          </p>
        </div>
      </button>

      {/* Super Admin Button - Only on main platform */}
      {showSuperAdmin && (
        <button
          onClick={onSuperAdminClick}
          className="w-full flex items-center gap-4 p-6 border-2 border-amber-500/30 rounded-xl hover:border-amber-500 hover:bg-amber-500/5 transition-all group"
        >
          <div className="p-4 rounded-full bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
            <Crown className="h-8 w-8" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-amber-600">SUPER ADMIN</h3>
            <p className="text-sm text-muted-foreground">Accès plateforme</p>
          </div>
        </button>
      )}
    </div>
  </div>
);

interface TeamChoiceScreenProps {
  onBack: () => void;
  onCRMLogin: () => void;
}

const TeamChoiceScreen = ({ onBack, onCRMLogin }: TeamChoiceScreenProps) => (
  <div className="space-y-6">
    <div className="flex items-center gap-2 mb-4">
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div>
        <h2 className="text-xl font-bold text-foreground">Espace Team</h2>
        <p className="text-sm text-muted-foreground">Que souhaitez-vous faire ?</p>
      </div>
    </div>

    <div className="grid gap-4">
      <button
        onClick={onCRMLogin}
        className="flex items-center gap-4 p-5 border rounded-xl hover:bg-muted transition-colors text-left group"
      >
        <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <LayoutDashboard className="h-7 w-7" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">Se connecter au CRM</h3>
          <p className="text-sm text-muted-foreground">Accédez à votre espace de gestion</p>
        </div>
      </button>

      <Link
        to="/deposer-contrat"
        className="flex items-center gap-4 p-5 border rounded-xl hover:bg-muted transition-colors text-left group"
      >
        <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
          <FileUp className="h-7 w-7" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">Déposer un contrat</h3>
          <p className="text-sm text-muted-foreground">Soumettez rapidement un nouveau contrat</p>
        </div>
      </Link>
    </div>
  </div>
);

interface ResetPasswordFormProps {
  email: string;
  setEmail: (value: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

const ResetPasswordForm = ({ email, setEmail, loading, onSubmit, onBack }: ResetPasswordFormProps) => (
  <div className="space-y-0">
    <div className="flex items-center gap-2 mb-6">
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div>
        <h2 className="text-xl font-bold text-foreground">Réinitialiser le mot de passe</h2>
        <p className="text-sm text-muted-foreground">Entrez votre email pour recevoir un lien</p>
      </div>
    </div>

    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.ch"
          autoComplete="email"
        />
      </div>

      <Button 
        type="submit" 
        disabled={loading}
        className="w-full mt-6"
      >
        {loading ? "Envoi en cours..." : "Envoyer le lien"}
      </Button>
    </form>
  </div>
);

const Connexion = () => {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const [view, setView] = useState<View>("choice");
  const [loginType, setLoginType] = useState<"client" | "team" | "king">("client");
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSmsVerification, setShowSmsVerification] = useState(false);
  const [smsVerificationData, setSmsVerificationData] = useState<{
    userId: string;
    phoneNumber: string;
  } | null>(null);
  const { toast } = useToast();
  const { signIn, resetPassword, user, clearPendingVerification } = useAuth();
  const navigate = useNavigate();
  
  // Flag to completely block redirects during SMS flow
  const smsFlowActive = useRef(false);
  
  // Get tenant display name and logo
  const displayName = tenant ? (tenant.branding?.display_name || tenant.name) : 'LYTA';
  const logoUrl = tenant?.branding?.logo_url;
  const showPlatformLogo = !tenant && !logoUrl;

  // Track if redirect is in progress to prevent duplicate calls
  const redirectInProgress = useRef(false);

  // Handle redirect after successful login (only when NOT in SMS flow)
  useEffect(() => {
    const handleRedirect = async () => {
      // CRITICAL: Never redirect during SMS verification flow
      if (smsFlowActive.current) {
        return;
      }
      
      if (showSmsVerification || smsVerificationData) {
        return;
      }

      if (!user) return;
      
      // Prevent duplicate redirect calls
      if (redirectInProgress.current) {
        return;
      }

      const targetSpace = sessionStorage.getItem('loginTarget');
      
      // If no target space set and user is already logged in, they just navigated here
      // Only check SMS requirement for new logins (when targetSpace exists)
      if (!targetSpace) {
        // User navigated to /connexion while logged in - quick redirect based on cached role
        redirectInProgress.current = true;
        
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        
        const role = roleData?.role || 'client';
        
        if (role === 'king') {
          navigate("/king/wizard", { replace: true });
        } else if (role === 'client') {
          navigate("/espace-client", { replace: true });
        } else {
          await redirectToTenantSubdomain(user.id);
        }
        redirectInProgress.current = false;
        return;
      }

      // New login flow - targetSpace is set
      redirectInProgress.current = true;

      // Get user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const role = roleData?.role || 'client';

      // Handle KING login
      if (targetSpace === 'king') {
        sessionStorage.removeItem('loginTarget');
        if (role === 'king') {
          navigate("/king/wizard", { replace: true });
        } else {
          toast({
            title: "Accès refusé",
            description: "Vous n'avez pas les droits SUPER ADMIN.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
        }
        redirectInProgress.current = false;
        return;
      }

      // KING users always go to /king/wizard
      if (role === 'king') {
        sessionStorage.removeItem('loginTarget');
        navigate("/king/wizard", { replace: true });
        redirectInProgress.current = false;
        return;
      }

      if (targetSpace === 'client') {
        sessionStorage.removeItem('loginTarget');
        navigate("/espace-client", { replace: true });
      } else if (targetSpace === 'team') {
        sessionStorage.removeItem('loginTarget');
        if (role === 'client') {
          toast({
            title: "Accès refusé",
            description: "Vous n'avez pas accès à l'espace Team.",
            variant: "destructive",
          });
          navigate("/espace-client", { replace: true });
        } else {
          await redirectToTenantSubdomain(user.id);
        }
      }
      
      redirectInProgress.current = false;
    };

    handleRedirect();
  }, [user, showSmsVerification, smsVerificationData]);

  // Ensure SMS dialog stays open if data exists
  useEffect(() => {
    if (smsVerificationData && !showSmsVerification) {
      setShowSmsVerification(true);
    }
  }, [smsVerificationData, showSmsVerification]);

  const checkSubdomainReachable = async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      // Reduced timeout from 3s to 1s for faster fallback
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      await fetch(`${url}/cdn-cgi/trace`, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
      clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  };

  const redirectToTenantSubdomain = async (userId: string) => {
    try {
      const { data: assignment } = await supabase
        .from('user_tenant_assignments')
        .select('tenant_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!assignment?.tenant_id) {
        navigate("/crm");
        return;
      }

      const { data: tenantData } = await supabase
        .from('tenants')
        .select('slug')
        .eq('id', assignment.tenant_id)
        .maybeSingle();

      if (!tenantData?.slug) {
        navigate("/crm");
        return;
      }

      const hostname = window.location.hostname;
      const isLocalhost = hostname === 'localhost' || hostname.includes('lovable');
      
      if (isLocalhost) {
        navigate(`/crm?tenant=${tenantData.slug}`);
      } else {
        const protocol = window.location.protocol;
        const baseDomain = hostname.split('.').slice(-2).join('.');
        const tenantUrl = `${protocol}//${tenantData.slug}.${baseDomain}`;
        const isReachable = await checkSubdomainReachable(tenantUrl);
        
        if (isReachable) {
          window.location.href = `${tenantUrl}/crm`;
        } else {
          navigate(`/crm?tenant=${tenantData.slug}`);
        }
      }
    } catch (error) {
      console.error('Error redirecting to tenant:', error);
      navigate("/crm");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer votre adresse email.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await resetPassword(email);
      
      if (error) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email envoyé",
          description: "Un email de réinitialisation a été envoyé à votre adresse.",
        });
        setIsResetPassword(false);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    // CRITICAL: Set flag BEFORE signIn to prevent any redirect
    smsFlowActive.current = true;
    console.log("[Connexion] Starting login, SMS flow flag set to true");

    try {
      const result = await signIn(email, password);
      
      if (result.error) {
        smsFlowActive.current = false;
        toast({
          title: "Erreur de connexion",
          description: result.error.message || "Email ou mot de passe incorrect.",
          variant: "destructive",
        });
      } else if (result.requiresSmsVerification && result.userId && result.phoneNumber) {
        // SMS verification required - keep flag active and show dialog
        console.log("[Connexion] SMS verification required for user:", result.userId);
        setSmsVerificationData({
          userId: result.userId,
          phoneNumber: result.phoneNumber,
        });
        setShowSmsVerification(true);
        toast({
          title: "Vérification requise",
          description: "Un code de vérification va être envoyé par SMS.",
        });
      } else {
        // No SMS required - set target FIRST, then clear flag
        // This ensures the redirect useEffect sees the correct target
        sessionStorage.setItem('loginTarget', loginType);
        smsFlowActive.current = false;
        toast({
          title: "Connexion réussie",
          description: `Bienvenue sur votre espace ${displayName}.`,
        });
      }
    } catch (error: any) {
      smsFlowActive.current = false;
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSmsVerified = async () => {
    console.log("[Connexion] SMS verified successfully");
    
    // Clear SMS state
    setSmsVerificationData(null);
    setShowSmsVerification(false);
    clearPendingVerification();
    
    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        smsFlowActive.current = false;
        toast({
          title: "Erreur",
          description: "Session expirée. Veuillez vous reconnecter.",
          variant: "destructive",
        });
        return;
      }
      
      // Get user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      
      const role = roleData?.role || 'client';
      
      toast({
        title: "Connexion réussie",
        description: `Bienvenue sur votre espace ${displayName}.`,
      });
      
      // Now we can clear the flag and redirect
      smsFlowActive.current = false;
      
      if (role === 'king') {
        navigate("/king/wizard");
      } else if (loginType === 'client') {
        navigate("/espace-client");
      } else if (role === 'admin') {
        // Admin users go to CRM with tenant
        await redirectToTenantSubdomain(currentUser.id);
      } else {
        // Team members also go to CRM
        await redirectToTenantSubdomain(currentUser.id);
      }
    } catch (error) {
      console.error("Error after SMS verification:", error);
      smsFlowActive.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleSmsCancelled = async () => {
    console.log("[Connexion] SMS verification cancelled");
    setSmsVerificationData(null);
    setShowSmsVerification(false);
    clearPendingVerification();
    smsFlowActive.current = false;
    setPassword("");
    await supabase.auth.signOut();
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setIsResetPassword(false);
  };

  const renderContent = () => {
    if (isResetPassword) {
      return (
        <ResetPasswordForm
          email={email}
          setEmail={setEmail}
          loading={loading}
          onSubmit={handleResetPassword}
          onBack={() => setIsResetPassword(false)}
        />
      );
    }
    
    switch (view) {
      case "client":
        return (
          <LoginForm 
            title="Espace Client" 
            subtitle="Connectez-vous à votre espace personnel"
            onBack={() => { resetForm(); setView("choice"); }}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            loading={loading}
            onSubmit={handleSubmit}
            onResetPassword={() => setIsResetPassword(true)}
          />
        );
      case "team":
        return (
          <TeamChoiceScreen
            onBack={() => setView("choice")}
            onCRMLogin={() => { setLoginType("team"); setView("team-login"); }}
          />
        );
      case "team-login":
        return (
          <LoginForm 
            title="Connexion CRM" 
            subtitle="Accédez à votre espace de gestion"
            onBack={() => { resetForm(); setView("team"); }}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            loading={loading}
            onSubmit={handleSubmit}
            onResetPassword={() => setIsResetPassword(true)}
          />
        );
      case "king":
        return (
          <LoginForm 
            title="SUPER ADMIN" 
            subtitle="Connexion plateforme"
            onBack={() => { resetForm(); setView("choice"); }}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            loading={loading}
            onSubmit={handleSubmit}
            onResetPassword={() => setIsResetPassword(true)}
          />
        );
      default:
        return (
          <ChoiceScreen
            onClientClick={() => { resetForm(); setLoginType("client"); setView("client"); }}
            onTeamClick={() => { resetForm(); setLoginType("team"); setView("team"); }}
            onSuperAdminClick={() => { resetForm(); setLoginType("king"); setView("king"); }}
            showSuperAdmin={!tenant}
            isTenantMode={!!tenant}
          />
        );
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-[url('/images/bg-pattern-gray.png')] opacity-40 pointer-events-none" />
      
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-20 relative z-10">
        <div className="text-center mb-8">
          {showPlatformLogo ? (
            <img src={lytaLogo} alt="Platform" className="h-24 sm:h-32 mx-auto" />
          ) : logoUrl ? (
            <img src={logoUrl} alt={displayName} className="h-24 sm:h-32 mx-auto" />
          ) : (
            <div className="flex items-center justify-center gap-3">
              <Building2 className="h-16 w-16 text-primary" />
              <span className="text-4xl font-bold">{displayName}</span>
            </div>
          )}
        </div>

        <div className="max-w-xl w-full bg-card rounded-xl shadow-lg border p-6 sm:p-8">
          {renderContent()}
        </div>
      </main>

      {/* SMS Verification Dialog - Always render when data exists */}
      {smsVerificationData && (
        <SmsVerificationDialog
          open={showSmsVerification}
          onOpenChange={(open) => {
            if (!open) {
              // Don't allow closing by clicking outside
              return;
            }
            setShowSmsVerification(open);
          }}
          userId={smsVerificationData.userId}
          phoneNumber={smsVerificationData.phoneNumber}
          verificationType="login"
          onVerified={handleSmsVerified}
          onCancel={handleSmsCancelled}
        />
      )}
    </div>
  );
};

export default Connexion;
