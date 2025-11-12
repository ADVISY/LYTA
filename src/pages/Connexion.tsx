import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import advisyLogo from "@/assets/advisy-logo.svg";
import { useAuth } from "@/hooks/useAuth";

const Connexion = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen bg-[#F8F9FA] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/images/bg-pattern-gray.png')] opacity-40" />
      
      <Link 
        to="/" 
        className="absolute top-6 left-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm border border-gray-200 hover:bg-white hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 z-10"
      >
        <ChevronLeft className="w-4 h-4" />
        Retour au site
      </Link>

      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-8 animate-fade-in">
          <img 
            src={advisyLogo} 
            alt="Advisy" 
            className="h-32 sm:h-40 mx-auto mb-8 drop-shadow-2xl hover:scale-105 transition-transform duration-300"
          />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Espace sécurisé Advisy
          </h1>
          <p className="text-slate-600">
            {isSignUp ? "Créez votre compte pour accéder à votre espace" : "Connectez-vous à votre espace client"}
          </p>
        </div>

        <div className="max-w-xl w-full bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 animate-scale-in">
          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="client">Client</TabsTrigger>
              <TabsTrigger value="partner">Partner</TabsTrigger>
            </TabsList>

            <TabsContent value="client" className="space-y-0">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-1">
                  {isSignUp ? "Créer un compte" : "Espace Client"}
                </h2>
                <p className="text-sm text-slate-600">
                  {isSignUp ? "Remplissez les informations ci-dessous" : "Connectez-vous à votre espace"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Prénom</Label>
                        <Input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Jean"
                          className="h-11"
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
                          className="h-11"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.ch"
                    className="h-11"
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
                    className="h-11"
                  />
                  {!isSignUp && (
                    <button
                      type="button"
                      className="text-xs text-[#1800AD] hover:underline"
                      onClick={() => toast({
                        title: "Mot de passe oublié",
                        description: "Contactez votre conseiller pour réinitialiser votre mot de passe.",
                      })}
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-[#1800AD] hover:bg-[#1800AD]/90 text-white font-semibold rounded-full h-11 mt-6 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-[1px]"
                >
                  {loading ? "Chargement..." : (isSignUp ? "Créer mon compte" : "Se connecter")}
                </Button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-sm text-slate-600 hover:text-[#1800AD]"
                  >
                    {isSignUp ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire"}
                  </button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="partner" className="space-y-0">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-1">
                  {isSignUp ? "Créer un compte Partner" : "Espace Partner"}
                </h2>
                <p className="text-sm text-slate-600">
                  {isSignUp ? "Inscription réservée aux partenaires Advisy" : "Connectez-vous à votre espace partenaire"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="firstName-partner">Prénom</Label>
                        <Input
                          id="firstName-partner"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Jean"
                          className="h-11"
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
                          className="h-11"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email-partner">Email professionnel</Label>
                  <Input
                    id="email-partner"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@advisy.ch"
                    className="h-11"
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
                    className="h-11"
                  />
                  {!isSignUp && (
                    <button
                      type="button"
                      className="text-xs text-[#1800AD] hover:underline"
                      onClick={() => toast({
                        title: "Mot de passe oublié",
                        description: "Contactez l'administrateur pour réinitialiser votre mot de passe.",
                      })}
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-[#1800AD] hover:bg-[#1800AD]/90 text-white font-semibold rounded-full h-11 mt-6 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-[1px]"
                >
                  {loading ? "Chargement..." : (isSignUp ? "Créer mon compte" : "Se connecter")}
                </Button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-sm text-slate-600 hover:text-[#1800AD]"
                  >
                    {isSignUp ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire"}
                  </button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Connexion;
