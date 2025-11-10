import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

const AssuranceSante = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        {/* Hero Section */}
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-gradient-subtle">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <Activity className="w-16 h-16 mx-auto text-primary" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Assurance santé en Suisse : trouvez la couverture adaptée à vos besoins.
              </h1>
              <p className="text-lg md:text-xl text-foreground/80 max-w-3xl mx-auto leading-relaxed">
                Advisy vous aide à comparer, comprendre et choisir la meilleure assurance maladie selon votre profil.
                Nous expliquons les différences entre modèles (médecin de famille, Telmed, HMO…) et les franchises pour trouver le bon équilibre entre coûts et prestations.
              </p>
              <Button size="lg" className="mt-8" onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}>
                🩺 Demandez votre analyse santé gratuite
              </Button>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto prose prose-lg">
              <h2 className="text-3xl font-bold mb-6">Nos prestations en assurance santé</h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">LAMal - Assurance de base</h3>
                  <p>Obligatoire pour tous les résidents en Suisse, l'assurance de base couvre les soins essentiels. Nous vous aidons à choisir le modèle et la franchise optimale.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">LCA - Assurances complémentaires</h3>
                  <p>Médecine douce, chambre privée, dentaire : personnalisez votre couverture selon vos besoins réels.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Modèles alternatifs</h3>
                  <p>Telmed, HMO, médecin de famille : découvrez les modèles qui permettent de réduire vos primes tout en maintenant une excellente qualité de soins.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AssuranceSante;
