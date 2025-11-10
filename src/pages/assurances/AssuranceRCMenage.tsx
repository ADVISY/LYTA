import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const AssuranceRCMenage = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-gradient-subtle">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <Home className="w-16 h-16 mx-auto text-primary" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Protégez vos biens et votre responsabilité à petit prix.
              </h1>
              <p className="text-lg md:text-xl text-foreground/80 max-w-3xl mx-auto leading-relaxed">
                RC privée et assurance ménage : deux protections complémentaires pour couvrir vos biens et vos responsabilités.
                Advisy vous aide à choisir les bonnes garanties pour éviter les mauvaises surprises.
              </p>
              <Button size="lg" className="mt-8" onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}>
                🏠 Obtenez votre devis RC & ménage
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto prose prose-lg">
              <h2 className="text-3xl font-bold mb-6">Nos solutions de protection</h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">Responsabilité civile privée</h3>
                  <p>Protection contre les dommages causés à des tiers : accidents, bris d'objets, etc. Indispensable pour tous.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Assurance ménage</h3>
                  <p>Couvre vos biens contre le vol, l'incendie, les dégâts d'eau et les bris de glace. Protection complète de votre logement.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Garanties optionnelles</h3>
                  <p>Objets de valeur, vélos électriques, instruments de musique : personnalisez votre couverture.</p>
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

export default AssuranceRCMenage;
