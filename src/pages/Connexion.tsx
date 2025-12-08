import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, LayoutDashboard, FileUp } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import advisyLogo from "@/assets/advisy-logo.svg";
import { useAuth } from "@/hooks/useAuth";

const Connexion = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [partnerChoice, setPartnerChoice] = useState<"none" | "crm" | "deposit">("none");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();

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

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/crm");
    }
  }, [user, navigate]);

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

  const PartnerChoiceScreen = () => (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-1">Espace Partner</h2>
        <p className="text-sm text-muted-foreground">Que souhaitez-vous faire ?</p>
      </div>

      <div className="grid gap-4">
        <button
          onClick={() => setPartnerChoice("crm")}
          className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted transition-colors text-left group"
        >
          <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Accès au CRM</h3>
            <p className="text-sm text-muted-foreground">Connectez-vous à votre espace de gestion</p>
          </div>
        </button>

        <Link
          to="/deposer-contrat"
          className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted transition-colors text-left group"
        >
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
            <FileUp className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Déposer un contrat</h3>
            <p className="text-sm text-muted-foreground">Soumettez rapidement un nouveau contrat</p>
          </div>
        </Link>
      </div>
    </div>
  );

  const PartnerLoginForm = () => (
    <div className="space-y-0">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => setPartnerChoice("none")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-xl font-bold text-foreground">
            {isSignUp ? "Créer un compte Partner" : "Connexion Partner"}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {isSignUp ? "Inscription réservée aux partenaires Advisy" : "Connectez-vous à votre espace partenaire"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName-partner">Prénom</Label>
              <Input
                id="firstName-partner"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jean"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName-partner">Nom</Label>
              <Input
                id="lastName-partner"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Dupont"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email-partner">Email professionnel</Label>
          <Input
            id="email-partner"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@advisy.ch"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password-partner">Mot de passe</Label>
          <Input
            id="password-partner"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {!isSignUp && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setIsResetPassword(true)}
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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/images/bg-pattern-gray.png')] opacity-40" />
      
      <Link 
        to="/" 
        className="absolute top-6 left-6 inline-flex items-center gap-2 text-sm font-medium text-foreground bg-card rounded-full px-4 py-2 shadow-sm border hover:shadow-md transition-all z-10"
      >
        <ChevronLeft className="w-4 h-4" />
        Retour au site
      </Link>

      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-8 animate-fade-in">
          <img 
            src={advisyLogo} 
            alt="Advisy" 
            className="h-32 sm:h-40 mx-auto mb-8"
          />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {isResetPassword ? "Réinitialiser le mot de passe" : "Espace sécurisé Advisy"}
          </h1>
          <p className="text-muted-foreground">
            {isResetPassword 
              ? "Entrez votre email pour recevoir un lien de réinitialisation" 
              : (isSignUp ? "Créez votre compte pour accéder à votre espace" : "Connectez-vous à votre espace")}
          </p>
        </div>

        {isResetPassword ? (
          <div className="max-w-xl w-full bg-card rounded-lg shadow-lg border p-6 sm:p-8 animate-scale-in">
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.ch"
                />
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full mt-6"
              >
                {loading ? "Envoi en cours..." : "Envoyer le lien"}
              </Button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setIsResetPassword(false)}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Retour à la connexion
                </button>
              </div>
            </form>
          </div>
        ) : (
        <div className="max-w-xl w-full bg-card rounded-lg shadow-lg border p-6 sm:p-8 animate-scale-in">
          <Tabs defaultValue="client" className="w-full" onValueChange={() => setPartnerChoice("none")}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="client">Client</TabsTrigger>
              <TabsTrigger value="partner">Partner</TabsTrigger>
            </TabsList>

            <TabsContent value="client" className="space-y-0">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground mb-1">
                  {isSignUp ? "Créer un compte" : "Espace Client"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isSignUp ? "Remplissez les informations ci-dessous" : "Connectez-vous à votre espace"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                  />
                  {!isSignUp && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setIsResetPassword(true)}
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
            </TabsContent>

            <TabsContent value="partner" className="space-y-0">
              {partnerChoice === "none" && <PartnerChoiceScreen />}
              {partnerChoice === "crm" && <PartnerLoginForm />}
            </TabsContent>
          </Tabs>
        </div>
        )}
      </main>
    </div>
  );
};

export default Connexion;
