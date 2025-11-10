import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { PiggyBank } from "lucide-react";

const Assurance3ePilier = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-gradient-subtle">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <PiggyBank className="w-16 h-16 mx-auto text-primary" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Préparez votre avenir avec le 3ᵉ pilier : sécurité, fiscalité et liberté.
              </h1>
              <p className="text-lg md:text-xl text-foreground/80 max-w-3xl mx-auto leading-relaxed">
                Le 3ᵉ pilier est un outil essentiel de planification financière.
                Advisy vous aide à choisir entre pilier 3a (lié) et 3b (libre), selon vos besoins et vos objectifs fiscaux.
              </p>
              <Button size="lg" className="mt-8" onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}>
                💰 Demandez votre étude 3ᵉ pilier personnalisée
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto prose prose-lg">
              <h2 className="text-3xl font-bold mb-6">Pourquoi investir dans le 3ᵉ pilier ?</h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">Pilier 3a - Prévoyance liée</h3>
                  <p>Déduction fiscale jusqu'à CHF 7'056 par an (salariés) ou CHF 35'280 (indépendants). Capital disponible pour l'achat d'un bien immobilier ou le départ à la retraite.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Pilier 3b - Prévoyance libre</h3>
                  <p>Flexibilité maximale : montants et durée à votre convenance. Capital disponible à tout moment.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Notre accompagnement</h3>
                  <p>Simulation complète de votre économie fiscale, comparaison des meilleures solutions du marché, optimisation selon votre situation personnelle.</p>
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

export default Assurance3ePilier;
