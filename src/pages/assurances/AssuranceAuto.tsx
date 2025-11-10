import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Car } from "lucide-react";

const AssuranceAuto = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-gradient-subtle">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <Car className="w-16 h-16 mx-auto text-primary" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Votre mobilité, notre priorité.
              </h1>
              <p className="text-lg md:text-xl text-foreground/80 max-w-3xl mx-auto leading-relaxed">
                RC, casco partielle, casco complète : nos conseillers trouvent la solution la plus adaptée à votre véhicule et votre budget.
              </p>
              <Button size="lg" className="mt-8" onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}>
                🚗 Recevez votre offre personnalisée
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto prose prose-lg">
              <h2 className="text-3xl font-bold mb-6">Nos formules d'assurance auto</h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">RC véhicule (obligatoire)</h3>
                  <p>Couvre les dommages causés aux tiers. Obligatoire pour circuler en Suisse.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Casco partielle</h3>
                  <p>Protection contre le vol, l'incendie, le bris de glace et les dommages naturels. Recommandée pour tous les véhicules.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Casco complète</h3>
                  <p>Couverture maximale incluant les dommages à votre propre véhicule, même en cas d'accident responsable.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Options et franchises</h3>
                  <p>Nous optimisons votre contrat : passagers, dépannage, véhicule de remplacement, franchise adaptée.</p>
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

export default AssuranceAuto;
