import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Connexion = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Connexion",
      description: "Fonctionnalité en cours de développement.",
    });
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-gradient-subtle">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <LogIn className="w-16 h-16 mx-auto text-primary mb-4" />
                <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                  Espace client Advisy
                </h1>
                <p className="text-lg text-foreground/80">
                  Connectez-vous pour suivre vos demandes, télécharger vos documents et contacter votre conseiller.
                </p>
              </div>

              <div className="bg-background/80 backdrop-blur-sm border border-border rounded-2xl p-8 shadow-medium">
                <form onSubmit={handleSubmit} className="space-y-6">
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
                  </div>

                  <Button type="submit" size="lg" className="w-full">
                    🔑 Se connecter
                  </Button>

                  <p className="text-sm text-center text-foreground/60">
                    Mot de passe oublié ? Contactez votre conseiller.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Connexion;
