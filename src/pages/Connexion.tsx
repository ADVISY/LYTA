import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, LayoutDashboard, FileUp, User, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import advisyLogo from "@/assets/advisy-logo.svg";
import { useAuth } from "@/hooks/useAuth";

type View = "choice" | "client" | "team" | "team-login";

interface LoginFormProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  isSignUp: boolean;
  setIsSignUp: (value: boolean) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onResetPassword: () => void;
}

const LoginForm = ({
  title,
  subtitle,
  onBack,
  isSignUp,
  setIsSignUp,
  email,
  setEmail,
  password,
  setPassword,
  firstName,
  setFirstName,
  lastName,
  setLastName,
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
        <h2 className="text-xl font-bold text-foreground">
          {isSignUp ? `Créer un compte ${title}` : title}
        </h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>

    <form onSubmit={onSubmit} className="space-y-4">
      {isSignUp && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">Prénom</Label>
            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jean"
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Nom</Label>
            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Dupont"
              autoComplete="family-name"
            />
          </div>
        </div>
      )}

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
          autoComplete={isSignUp ? "new-password" : "current-password"}
        />
        {!isSignUp && (
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={onResetPassword}
          >
            Mot de passe oublié ?
          </button>
        )}
      </div>

      <Button 
        type="submit" 
        disabled={loading}
        className="w-full mt-6"
      >
        {loading ? "Chargement..." : (isSignUp ? "Créer mon compte" : "Se connecter")}
      </Button>

      <div className="text-center mt-4">
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          {isSignUp ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire"}
        </button>
      </div>
    </form>
  </div>
);

interface ChoiceScreenProps {
  onClientClick: () => void;
  onTeamClick: () => void;
}

const ChoiceScreen = ({ onClientClick, onTeamClick }: ChoiceScreenProps) => (
  <div className="space-y-8">
    <div className="text-center">
      <h2 className="text-xl font-bold text-foreground mb-2">Bienvenue sur Advisy</h2>
      <p className="text-sm text-muted-foreground">Sélectionnez votre espace</p>
    </div>

    <div className="grid grid-cols-2 gap-6">
      <button
        onClick={onClientClick}
        className="flex flex-col items-center gap-4 p-8 border-2 rounded-xl hover:border-primary hover:bg-primary/5 transition-all group"
      >
        <div className="p-4 rounded-full bg-blue-500/10 text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
          <User className="h-10 w-10" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-foreground">CLIENT</h3>
          <p className="text-sm text-muted-foreground mt-1">Accès espace client</p>
        </div>
      </button>

      <button
        onClick={onTeamClick}
        className="flex flex-col items-center gap-4 p-8 border-2 rounded-xl hover:border-primary hover:bg-primary/5 transition-all group"
      >
        <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
          <Users className="h-10 w-10" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-foreground">TEAM</h3>
          <p className="text-sm text-muted-foreground mt-1">Membres Advisy</p>
        </div>
      </button>
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
  const [view, setView] = useState<View>("choice");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/crm");
    }
  }, [user, navigate]);

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

    try {
      if (isSignUp) {
        if (!firstName || !lastName) {
          toast({
            title: "Erreur",
            description: "Veuillez entrer votre prénom et nom.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password, firstName, lastName);
        
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Erreur",
              description: "Cet email est déjà enregistré. Veuillez vous connecter.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erreur",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Inscription réussie",
            description: "Vous êtes maintenant connecté à votre espace.",
          });
          navigate("/crm");
        }
      } else {
        const { error } = await signIn(email, password);
        
        if (error) {
          toast({
            title: "Erreur de connexion",
            description: "Email ou mot de passe incorrect.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Connexion réussie",
            description: "Bienvenue sur votre espace Advisy.",
          });
          navigate("/crm");
        }
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

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setIsSignUp(false);
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
            isSignUp={isSignUp}
            setIsSignUp={setIsSignUp}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            loading={loading}
            onSubmit={handleSubmit}
            onResetPassword={() => setIsResetPassword(true)}
          />
        );
      case "team":
        return (
          <TeamChoiceScreen
            onBack={() => setView("choice")}
            onCRMLogin={() => setView("team-login")}
          />
        );
      case "team-login":
        return (
          <LoginForm 
            title="Connexion CRM" 
            subtitle="Accédez à votre espace de gestion"
            onBack={() => { resetForm(); setView("team"); }}
            isSignUp={isSignUp}
            setIsSignUp={setIsSignUp}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            loading={loading}
            onSubmit={handleSubmit}
            onResetPassword={() => setIsResetPassword(true)}
          />
        );
      default:
        return (
          <ChoiceScreen
            onClientClick={() => { resetForm(); setView("client"); }}
            onTeamClick={() => { resetForm(); setView("team"); }}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-[url('/images/bg-pattern-gray.png')] opacity-40 pointer-events-none" />
      
      <Link 
        to="/" 
        className="fixed top-6 left-6 inline-flex items-center gap-2 text-sm font-medium text-foreground bg-card rounded-full px-4 py-2 shadow-sm border hover:shadow-md transition-all z-50"
      >
        <ChevronLeft className="w-4 h-4" />
        Retour au site
      </Link>

      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-20 relative z-10">
        <div className="text-center mb-8">
          <img 
            src={advisyLogo} 
            alt="Advisy" 
            className="h-24 sm:h-32 mx-auto"
          />
        </div>

        <div className="max-w-xl w-full bg-card rounded-xl shadow-lg border p-6 sm:p-8">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Connexion;
