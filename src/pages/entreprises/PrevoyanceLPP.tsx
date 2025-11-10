import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

const PrevoyanceLPP = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-gradient-subtle">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <Shield className="w-16 h-16 mx-auto text-primary" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Prévoyance professionnelle (LPP)
              </h1>
              <p className="text-lg md:text-xl text-foreground/80 max-w-3xl mx-auto leading-relaxed">
                Choisissez la caisse de pension adaptée à votre taille et votre budget.
              </p>
              <Button size="lg" className="mt-8" onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}>
                Optimisez votre LPP
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto prose prose-lg">
              <h2 className="text-3xl font-bold mb-6">Prévoyance professionnelle sur mesure</h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">Comparaison des caisses</h3>
                  <p>Nous analysons les meilleures fondations LPP selon vos critères : prestations, coûts, flexibilité.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Plans suroblgatoires</h3>
                  <p>Offrez à vos collaborateurs une prévoyance supérieure au minimum légal pour les fidéliser.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Gestion simplifiée</h3>
                  <p>Accompagnement dans la mise en place, l'administration et les mutations de personnel.</p>
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

export default PrevoyanceLPP;
