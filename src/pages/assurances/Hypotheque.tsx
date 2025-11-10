import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

const Hypotheque = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-gradient-subtle">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <Building2 className="w-16 h-16 mx-auto text-primary" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Réalisez votre projet immobilier avec sérénité.
              </h1>
              <p className="text-lg md:text-xl text-foreground/80 max-w-3xl mx-auto leading-relaxed">
                Advisy compare pour vous les meilleures offres d'hypothèques selon votre profil et votre projet.
                Optimisez votre taux et votre fiscalité avec un accompagnement complet.
              </p>
              <Button size="lg" className="mt-8" onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}>
                🏡 Demandez votre simulation gratuite
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto prose prose-lg">
              <h2 className="text-3xl font-bold mb-6">Nos solutions de financement</h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">Hypothèque fixe</h3>
                  <p>Sécurité et prévisibilité : taux fixe sur 2, 5, 10 ans ou plus. Idéal pour planifier votre budget.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Hypothèque SARON</h3>
                  <p>Flexibilité et taux compétitifs : suivez l'évolution du marché avec un taux variable.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Optimisation fiscale</h3>
                  <p>Déduction des intérêts hypothécaires, utilisation du 3ᵉ pilier : maximisez vos avantages.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Accompagnement complet</h3>
                  <p>De la simulation à la signature, nous vous guidons à chaque étape de votre projet immobilier.</p>
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

export default Hypotheque;
