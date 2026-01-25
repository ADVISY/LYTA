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
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/ui/language-selector";
import { MouseGradient } from "@/components/ui/mouse-gradient";
import { ReactiveGrid } from "@/components/ui/reactive-grid";

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

interface LoginFormTranslations {
  email: string;
  password: string;
  forgotPassword: string;
  loading: string;
  loginButton: string;
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
  translations,
}: LoginFormProps & { translations: LoginFormTranslations }) => (
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
        <Label htmlFor="email">{translations.email}</Label>
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
        <Label htmlFor="password">{translations.password}</Label>
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
          {translations.forgotPassword}
        </button>
      </div>

      <Button 
        type="submit" 
        disabled={loading}
        className="w-full mt-6"
      >
        {loading ? translations.loading : translations.loginButton}
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
  hasClientPortal?: boolean;
  translations: {
    welcome: string;
    welcomePlatform: string;
    selectSpace: string;
    clientSpace: string;
    clientSpaceDesc: string;
    teamSpace: string;
    teamSpaceDesc: string;
    lytaMember: string;
    lytaMemberDesc: string;
    superAdmin: string;
    superAdminDesc: string;
  };
}

const ChoiceScreen = ({ onClientClick, onTeamClick, onSuperAdminClick, showSuperAdmin = true, isTenantMode = false, hasClientPortal = false, translations }: ChoiceScreenProps) => (
  <div className="space-y-8">
    <div className="text-center">
      <h2 className="text-xl font-bold text-foreground mb-2">
        {isTenantMode ? translations.welcome : translations.welcomePlatform}
      </h2>
      <p className="text-sm text-muted-foreground">{translations.selectSpace}</p>
    </div>

    <div className="space-y-4">
      {/* Client Access - Only for tenants with client_portal module (Prime/Founder) */}
      {isTenantMode && hasClientPortal && (
        <button
          onClick={onClientClick}
          className="w-full flex items-center gap-4 p-6 border-2 rounded-xl hover:border-primary hover:bg-primary/5 transition-all group"
        >
          <div className="p-4 rounded-full bg-blue-500/10 text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
            <User className="h-8 w-8" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-foreground">{translations.clientSpace}</h3>
            <p className="text-sm text-muted-foreground">{translations.clientSpaceDesc}</p>
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
            {isTenantMode ? translations.teamSpace : translations.lytaMember}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isTenantMode ? translations.teamSpaceDesc : translations.lytaMemberDesc}
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
            <h3 className="text-lg font-bold text-amber-600">{translations.superAdmin}</h3>
            <p className="text-sm text-muted-foreground">{translations.superAdminDesc}</p>
          </div>
        </button>
      )}
    </div>
  </div>
);

interface TeamChoiceScreenProps {
  onBack: () => void;
  onCRMLogin: () => void;
  translations: {
    teamSpace: string;
    whatToDo: string;
    connectCRM: string;
    connectCRMDesc: string;
    depositContract: string;
    depositContractDesc: string;
  };
}

const TeamChoiceScreen = ({ onBack, onCRMLogin, translations }: TeamChoiceScreenProps) => (
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
        <h2 className="text-xl font-bold text-foreground">{translations.teamSpace}</h2>
        <p className="text-sm text-muted-foreground">{translations.whatToDo}</p>
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
          <h3 className="font-semibold text-foreground text-lg">{translations.connectCRM}</h3>
          <p className="text-sm text-muted-foreground">{translations.connectCRMDesc}</p>
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
          <h3 className="font-semibold text-foreground text-lg">{translations.depositContract}</h3>
          <p className="text-sm text-muted-foreground">{translations.depositContractDesc}</p>
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
  translations: {
    resetPassword: string;
    resetPasswordDesc: string;
    email: string;
    sending: string;
    sendLink: string;
  };
}

const ResetPasswordForm = ({ email, setEmail, loading, onSubmit, onBack, translations }: ResetPasswordFormProps) => (
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
        <h2 className="text-xl font-bold text-foreground">{translations.resetPassword}</h2>
        <p className="text-sm text-muted-foreground">{translations.resetPasswordDesc}</p>
      </div>
    </div>

    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">{translations.email}</Label>
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
        {loading ? translations.sending : translations.sendLink}
      </Button>
    </form>
  </div>
);

const Connexion = () => {
  const { t } = useTranslation();
  const { tenant, isLoading: tenantLoading, hasClientPortal } = useTenant();
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

  // Translation objects for sub-components
  const loginTranslations = {
    email: t('auth.email'),
    password: t('auth.password'),
    forgotPassword: t('auth.forgotPassword'),
    loading: t('auth.loggingIn'),
    loginButton: t('auth.loginButton'),
  };

  const choiceTranslations = {
    welcome: t('auth.welcome'),
    welcomePlatform: t('auth.welcomePlatform', 'Bienvenue sur LYTA'),
    selectSpace: t('auth.selectSpace'),
    clientSpace: t('auth.clientSpace'),
    clientSpaceDesc: t('auth.clientSpaceDesc'),
    teamSpace: t('auth.teamSpace'),
    teamSpaceDesc: t('auth.teamSpaceDesc'),
    lytaMember: t('auth.lytaMember', 'MEMBRE LYTA'),
    lytaMemberDesc: t('auth.lytaMemberDesc', 'Support & Développement'),
    superAdmin: t('auth.superAdmin'),
    superAdminDesc: t('auth.superAdminDesc'),
  };

  const teamChoiceTranslations = {
    teamSpace: t('auth.teamSpace'),
    whatToDo: t('auth.whatToDo', 'Que souhaitez-vous faire ?'),
    connectCRM: t('auth.connectCRM', 'Se connecter au CRM'),
    connectCRMDesc: t('auth.connectCRMDesc', 'Accédez à votre espace de gestion'),
    depositContract: t('auth.depositContract', 'Déposer un contrat'),
    depositContractDesc: t('auth.depositContractDesc', 'Soumettez rapidement un nouveau contrat'),
  };

  const resetPasswordTranslations = {
    resetPassword: t('auth.resetPassword'),
    resetPasswordDesc: t('auth.resetPasswordDesc', 'Entrez votre email pour recevoir un lien'),
    email: t('auth.email'),
    sending: t('auth.sending', 'Envoi en cours...'),
    sendLink: t('auth.sendLink', 'Envoyer le lien'),
  };

  // Store stable refs for functions that may change
  const navigateRef = useRef(navigate);
  const toastRef = useRef(toast);
  
  useEffect(() => {
    navigateRef.current = navigate;
    toastRef.current = toast;
  });

  // Roles that require SMS 2FA - ALL roles require SMS authentication
  const ROLES_REQUIRING_2FA = ['king', 'admin', 'manager', 'agent', 'backoffice', 'compta', 'partner', 'client'];
  const SMS_VERIFICATION_VALIDITY_MINUTES = 120; // 2 hours

  // Handle redirect after successful login (only when NOT in SMS flow)
  // Use a ref to track if we've already processed this user session
  const processedUserRef = useRef<string | null>(null);
  
  useEffect(() => {
    const handleRedirect = async () => {
      // Wait for the login submit to finish (prevents "redirect missed" race)
      if (loading) return;

      // CRITICAL: Never redirect during SMS verification flow
      if (smsFlowActive.current) {
        return;
      }

      if (showSmsVerification || smsVerificationData) {
        return;
      }

      if (!user) {
        // Reset processed user when user logs out
        processedUserRef.current = null;
        return;
      }

      // Prevent duplicate redirect calls for the same user session
      if (redirectInProgress.current) {
        return;
      }
      
      // If we've already processed this exact user, don't do it again
      if (processedUserRef.current === user.id) {
        return;
      }

      redirectInProgress.current = true;
      
      // SECURITY CHECK: User has session but may need SMS 2FA
      // Check if user has a role requiring 2FA and verify SMS status
      try {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        
        const roles = (rolesData ?? []).map(r => r.role as string);
        const needsSms2FA = roles.some(r => ROLES_REQUIRING_2FA.includes(r));
        
        if (needsSms2FA) {
          // Check if user has a valid recent SMS verification
          const minValidTime = new Date();
          minValidTime.setMinutes(minValidTime.getMinutes() - SMS_VERIFICATION_VALIDITY_MINUTES);
          
          const { data: smsVerification } = await supabase
            .from('sms_verifications')
            .select('id, verified_at')
            .eq('user_id', user.id)
            .eq('verification_type', 'login')
            .not('verified_at', 'is', null)
            .gte('verified_at', minValidTime.toISOString())
            .order('verified_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (!smsVerification) {
            // User needs to complete SMS 2FA!
            console.log('[Connexion] User has session but needs SMS 2FA verification');
            
            // Get user's phone number
            const { data: profile } = await supabase
              .from('profiles')
              .select('phone')
              .eq('id', user.id)
              .maybeSingle();
            
            const phoneNumber = profile?.phone || user.phone;
            
            if (!phoneNumber) {
              // No phone number - sign out and show error
              toastRef.current({
                title: "Vérification SMS requise",
                description: "Aucun numéro de téléphone configuré. Contactez l'administrateur.",
                variant: "destructive",
              });
              await supabase.auth.signOut();
              redirectInProgress.current = false;
              return;
            }
            
            // Show SMS verification dialog
            smsFlowActive.current = true;
            setSmsVerificationData({
              userId: user.id,
              phoneNumber,
            });
            setShowSmsVerification(true);
            redirectInProgress.current = false;
            
            toastRef.current({
              title: "Vérification requise",
              description: "Veuillez compléter la vérification SMS pour accéder à votre espace.",
            });
            return;
          }
        }
      } catch (err) {
        console.error('[Connexion] Error checking SMS verification:', err);
      }
      try {
        const targetSpace =
          sessionStorage.getItem('loginTarget') ||
          sessionStorage.getItem('lyta_login_space');

        // OPTIMIZATION: Use cached login data from signIn (no extra DB calls!)
        const cachedDataStr = sessionStorage.getItem('userLoginData');
        let cachedData: { role: string; tenant_slug: string | null } | null = null;
        
        if (cachedDataStr) {
          try {
            cachedData = JSON.parse(cachedDataStr);
          } catch {
            cachedData = null;
          }
        }

        const goToTenantCrm = (tenantSlug: string) => {
          const hostname = window.location.hostname;
          const isLocalhost = hostname === 'localhost' || hostname.includes('lovable');

          if (isLocalhost) {
            navigateRef.current(`/crm?tenant=${tenantSlug}`, { replace: true });
            return;
          }

          const protocol = window.location.protocol;
          const baseDomain = hostname.split('.').slice(-2).join('.');
          window.location.href = `${protocol}//${tenantSlug}.${baseDomain}/crm`;
        };

        // Global roles (client/king) are stored in user_roles. Team access is tenant-based.
        const getGlobalRole = async (): Promise<'king' | 'client' | string> => {
          if (cachedData?.role) return cachedData.role;

          const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

          if (error) {
            console.error('[Connexion] Error fetching global roles:', error);
            return 'client';
          }

          const roles = (data ?? []).map((r) => r.role as string);
          if (roles.includes('king')) return 'king';
          if (roles.includes('client')) return 'client';
          return roles[0] ?? 'client';
        };

        const getTenantAssignment = async (): Promise<{
          tenantId: string | null;
          tenantSlug: string | null;
          isPlatformAdmin: boolean;
        }> => {
          // cachedData contains tenant_slug but not tenant_id.
          const { data, error } = await supabase
            .from('user_tenant_assignments')
            .select('tenant_id, is_platform_admin, tenants(slug)')
            .eq('user_id', user.id)
            .not('tenant_id', 'is', null)
            .maybeSingle();

          if (error) {
            console.error('[Connexion] Error fetching tenant assignment:', error);
          }

          const tenantSlug =
            cachedData?.tenant_slug ?? ((data?.tenants as any)?.slug || null);

          return {
            tenantId: (data?.tenant_id as string | undefined) ?? null,
            tenantSlug,
            isPlatformAdmin: Boolean((data as any)?.is_platform_admin),
          };
        };

        const getTeamAccess = async (): Promise<{
          allowed: boolean;
          tenantSlug: string | null;
        }> => {
          const assignment = await getTenantAssignment();

          if (!assignment.tenantId) {
            return { allowed: false, tenantSlug: null };
          }

          // Platform admins are allowed regardless of tenant role assignment.
          if (assignment.isPlatformAdmin) {
            return { allowed: true, tenantSlug: assignment.tenantSlug };
          }

          const { data: tenantRoles, error } = await supabase
            .from('user_tenant_roles')
            .select('id')
            .eq('user_id', user.id)
            .eq('tenant_id', assignment.tenantId)
            .limit(1);

          if (error) {
            console.error('[Connexion] Error fetching tenant roles:', error);
            return { allowed: false, tenantSlug: assignment.tenantSlug };
          }

          return {
            allowed: (tenantRoles?.length ?? 0) > 0,
            tenantSlug: assignment.tenantSlug,
          };
        };

        // Clean up cached data after use
        sessionStorage.removeItem('userLoginData');

        // Mark this user as processed to prevent re-running
        processedUserRef.current = user.id;

        // If no target space set, user navigated to /connexion while logged in
        // IMPORTANT: we must set an intended space, otherwise ProtectedRoute will bounce back to /connexion.
        if (!targetSpace) {
          const globalRole = await getGlobalRole();

          if (globalRole === 'king') {
            sessionStorage.setItem('lyta_login_space', 'king');
            navigateRef.current("/king/wizard", { replace: true });
            return;
          }

          const teamAccess = await getTeamAccess();
          if (teamAccess.allowed) {
            sessionStorage.setItem('lyta_login_space', 'team');
            if (teamAccess.tenantSlug) {
              goToTenantCrm(teamAccess.tenantSlug);
            } else {
              navigateRef.current("/crm", { replace: true });
            }
            return;
          }

          // Fall back to client space only if user has a client role/record
          if (globalRole === 'client') {
            sessionStorage.setItem('lyta_login_space', 'client');
            navigateRef.current("/espace-client", { replace: true });
            return;
          }

          const { data: clientRecord } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (clientRecord) {
            sessionStorage.setItem('lyta_login_space', 'client');
            navigateRef.current("/espace-client", { replace: true });
            return;
          }

          toastRef.current({
            title: "Accès refusé",
            description: "Votre compte n'a accès ni au CRM ni à l'espace client pour ce cabinet.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          return;
        }

        // New login flow - targetSpace is set
        sessionStorage.removeItem('loginTarget');

        if (targetSpace === 'king') {
          const globalRole = await getGlobalRole();
          if (globalRole === 'king') {
            navigateRef.current("/king/wizard", { replace: true });
          } else {
            toastRef.current({
              title: "Accès refusé",
              description: "Vous n'avez pas les droits SUPER ADMIN.",
              variant: "destructive",
            });
            await supabase.auth.signOut();
          }
          return;
        }

        const globalRole = await getGlobalRole();

        // KING users always go to /king/wizard
        if (globalRole === 'king') {
          navigateRef.current("/king/wizard", { replace: true });
          return;
        }

        if (targetSpace === 'client') {
          // SECURITY: Verify user actually has client access before redirecting
          const hasClientAccess = globalRole === 'client';
          
          if (!hasClientAccess) {
            // Check if user has a client record
            const { data: clientRecord } = await supabase
              .from('clients')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();
            
            if (!clientRecord) {
              toastRef.current({
                title: "Accès refusé",
                description: "Votre compte n'a pas accès à l'espace client.",
                variant: "destructive",
              });
              sessionStorage.clear();
              await supabase.auth.signOut();
              redirectInProgress.current = false;
              return;
            }
          }
          
          navigateRef.current("/espace-client", { replace: true });
          return;
        }

        // targetSpace === 'team'
        const teamAccess = await getTeamAccess();
        if (!teamAccess.allowed) {
          toastRef.current({
            title: "Accès refusé",
            description: "Votre compte n'a pas accès au CRM (Espace Team).",
            variant: "destructive",
          });
          // Keep spaces strictly separated: force re-login if team access is missing.
          await supabase.auth.signOut();
          return;
        }

        if (teamAccess.tenantSlug) {
          goToTenantCrm(teamAccess.tenantSlug);
        } else {
          navigateRef.current("/crm", { replace: true });
        }
      } finally {
        redirectInProgress.current = false;
      }
    };

    handleRedirect();
  }, [user?.id, loading, showSmsVerification, smsVerificationData]);

  // Ensure SMS dialog stays open if data exists
  useEffect(() => {
    if (smsVerificationData && !showSmsVerification) {
      setShowSmsVerification(true);
    }
  }, [smsVerificationData, showSmsVerification]);

  const redirectToTenantSubdomain = async (userId: string) => {
    try {
      // Check cache first
      const cachedDataStr = sessionStorage.getItem('userLoginData');
      if (cachedDataStr) {
        try {
          const cachedData = JSON.parse(cachedDataStr);
          if (cachedData?.tenant_slug) {
            sessionStorage.removeItem('userLoginData');
            const hostname = window.location.hostname;
            const isLocalhost = hostname === 'localhost' || hostname.includes('lovable');

            if (isLocalhost) {
              navigate(`/crm?tenant=${cachedData.tenant_slug}`, { replace: true });
              return;
            }

            const protocol = window.location.protocol;
            const baseDomain = hostname.split('.').slice(-2).join('.');
            window.location.href = `${protocol}//${cachedData.tenant_slug}.${baseDomain}/crm`;
            return;
          }
        } catch {
          // ignore parse errors
        }
      }

      const { data: assignment } = await supabase
        .from('user_tenant_assignments')
        .select('tenant_id, tenants(slug)')
        .eq('user_id', userId)
        .maybeSingle();

      const tenantSlug = (assignment?.tenants as any)?.slug as string | undefined;

      if (!tenantSlug) {
        navigate("/crm", { replace: true });
        return;
      }

      const hostname = window.location.hostname;
      const isLocalhost = hostname === 'localhost' || hostname.includes('lovable');

      if (isLocalhost) {
        navigate(`/crm?tenant=${tenantSlug}`, { replace: true });
      } else {
        const protocol = window.location.protocol;
        const baseDomain = hostname.split('.').slice(-2).join('.');
        window.location.href = `${protocol}//${tenantSlug}.${baseDomain}/crm`;
      }
    } catch (error) {
      console.error('Error redirecting to tenant:', error);
      navigate("/crm", { replace: true });
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

    // IMPORTANT: set target BEFORE sign-in to avoid redirect race
    sessionStorage.setItem('loginTarget', loginType);
    // Persist chosen space for the whole session (strict space separation)
    sessionStorage.setItem('lyta_login_space', loginType);

    setLoading(true);
    // CRITICAL: Set flag BEFORE signIn to prevent any redirect
    smsFlowActive.current = true;
    console.log("[Connexion] Starting login, SMS flow flag set to true");

    try {
      const result = await signIn(email, password);

      if (result.error) {
        // Remove target when login fails
        sessionStorage.removeItem('loginTarget');
        sessionStorage.removeItem('lyta_login_space');
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
        // No SMS required - clear flag and let redirect effect run
        smsFlowActive.current = false;
        toast({
          title: "Connexion réussie",
          description: `Bienvenue sur votre espace ${displayName}.`,
        });
      }
    } catch (error: any) {
      sessionStorage.removeItem('loginTarget');
      sessionStorage.removeItem('lyta_login_space');
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

    // IMPORTANT: keep chosen space (lyta_login_space), but clear one-shot target
    sessionStorage.removeItem('loginTarget');

    // Clear SMS state
    setSmsVerificationData(null);
    setShowSmsVerification(false);
    clearPendingVerification();

    // Allow the redirect effect to run now that SMS is completed
    smsFlowActive.current = false;
    processedUserRef.current = null;

    toast({
      title: "Connexion réussie",
      description: `Bienvenue sur votre espace ${displayName}.`,
    });
  };

  const handleSmsCancelled = async () => {
    console.log("[Connexion] SMS verification cancelled");
    sessionStorage.removeItem('loginTarget');
    sessionStorage.removeItem('lyta_login_space');
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
          translations={resetPasswordTranslations}
        />
      );
    }
    
    switch (view) {
      case "client":
        return (
          <LoginForm 
            title={t('auth.clientSpace')} 
            subtitle={t('auth.clientSpaceDesc')}
            onBack={() => { resetForm(); setView("choice"); }}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            loading={loading}
            onSubmit={handleSubmit}
            onResetPassword={() => setIsResetPassword(true)}
            translations={loginTranslations}
          />
        );
      case "team":
        return (
          <TeamChoiceScreen
            onBack={() => setView("choice")}
            onCRMLogin={() => { setLoginType("team"); setView("team-login"); }}
            translations={teamChoiceTranslations}
          />
        );
      case "team-login":
        return (
          <LoginForm 
            title={t('auth.crmLogin', 'Connexion CRM')} 
            subtitle={t('auth.crmLoginDesc', 'Accédez à votre espace de gestion')}
            onBack={() => { resetForm(); setView("team"); }}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            loading={loading}
            onSubmit={handleSubmit}
            onResetPassword={() => setIsResetPassword(true)}
            translations={loginTranslations}
          />
        );
      case "king":
        return (
          <LoginForm 
            title={t('auth.superAdmin')} 
            subtitle={t('auth.superAdminDesc')}
            onBack={() => { resetForm(); setView("choice"); }}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            loading={loading}
            onSubmit={handleSubmit}
            onResetPassword={() => setIsResetPassword(true)}
            translations={loginTranslations}
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
            hasClientPortal={hasClientPortal}
            translations={choiceTranslations}
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

  // Determine gradient color based on context
  // Priority: tenant branding color > LYTA gold (for main platform)
  const getGradientColor = () => {
    // If we have a tenant with a custom primary color, use it
    if (tenant?.branding?.primary_color) {
      return tenant.branding.primary_color; // hex color like #1800AD
    }
    // Default to LYTA gold for the main platform
    return "#D4A418"; // LYTA gold
  };

  return (
    <MouseGradient 
      className="min-h-screen bg-background"
      gradientColor={getGradientColor()}
      gradientSize={1000}
      intensity={0.5}
      alwaysVisible={true}
    >
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageSelector />
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
    </MouseGradient>
  );
};

export default Connexion;
