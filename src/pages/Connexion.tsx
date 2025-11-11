import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import advisyTextLogo from "@/assets/advisy-text-logo.svg";

const Connexion = () => {
  const [clientEmail, setClientEmail] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerPassword, setPartnerPassword] = useState("");
  const { toast } = useToast();

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientEmail || !clientPassword) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Connexion client",
      description: "Fonctionnalité en cours de développement.",
    });
  };

  const handlePartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!partnerEmail || !partnerPassword) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Connexion Partners",
      description: "Fonctionnalité en cours de développement.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-[0.03]" />
      
      {/* Retour au site button */}
      <Link 
        to="/" 
        className="absolute top-6 left-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm border border-gray-200 hover:bg-white hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 z-10"
      >
        <ChevronLeft className="w-4 h-4" />
        Retour au site
      </Link>

      {/* Main content */}
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <img 
            src={advisyTextLogo} 
            alt="Advisy" 
            className="h-12 mx-auto mb-6"
          />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Espace sécurisé Advisy
          </h1>
          <p className="text-slate-600">
            Connectez-vous à votre espace client ou à votre espace partenaire.
          </p>
        </div>

        {/* Login panel */}
        <div className="max-w-xl w-full bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 animate-scale-in">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              Connexion à votre espace
            </h2>
            <p className="text-sm text-slate-600">
              Sélectionnez votre type d'accès puis entrez vos identifiants.
            </p>
          </div>

          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 rounded-full p-1 mb-6">
              <TabsTrigger 
                value="client" 
                className="rounded-full data-[state=active]:bg-[#1800AD] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
              >
                Client
              </TabsTrigger>
              <TabsTrigger 
                value="partners" 
                className="rounded-full data-[state=active]:bg-[#1800AD] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
              >
                Partners
              </TabsTrigger>
            </TabsList>

            <TabsContent value="client" className="animate-fade-in">
              <form onSubmit={handleClientSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client-email">Email</Label>
                  <Input
                    id="client-email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="votre@email.ch"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-password">Mot de passe</Label>
                  <Input
                    id="client-password"
                    type="password"
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11"
                  />
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
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-[#1800AD] hover:bg-[#1800AD]/90 text-white font-semibold rounded-full h-11 mt-6 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-[1px]"
                >
                  Se connecter à l'espace client
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="partners" className="animate-fade-in">
              <form onSubmit={handlePartnerSubmit} className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-900">
                    Accès réservé aux membres de l'équipe Advisy
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partner-email">Email professionnel</Label>
                  <Input
                    id="partner-email"
                    type="email"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    placeholder="prenom.nom@advisy.ch"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partner-password">Mot de passe</Label>
                  <Input
                    id="partner-password"
                    type="password"
                    value={partnerPassword}
                    onChange={(e) => setPartnerPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-[#1800AD] hover:bg-[#1800AD]/90 text-white font-semibold rounded-full h-11 mt-6 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-[1px]"
                >
                  Se connecter à l'espace Partners
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Connexion;
