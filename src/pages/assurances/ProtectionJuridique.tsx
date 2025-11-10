import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Scale } from "lucide-react";

const ProtectionJuridique = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-gradient-subtle">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <Scale className="w-16 h-16 mx-auto text-primary" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Ne soyez plus seul face aux litiges.
              </h1>
              <p className="text-lg md:text-xl text-foreground/80 max-w-3xl mx-auto leading-relaxed">
                La protection juridique vous aide à défendre vos droits sans supporter les frais d'avocat.
                Droit du travail, circulation, logement : nous vous accompagnons dans chaque domaine.
              </p>
              <Button size="lg" className="mt-8" onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}>
                ⚖️ Protégez vos droits dès maintenant
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto prose prose-lg">
              <h2 className="text-3xl font-bold mb-6">Nos domaines de protection</h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">Droit du travail</h3>
                  <p>Licenciement abusif, salaire impayé, conflit avec l'employeur : défendez vos droits.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Circulation routière</h3>
                  <p>Amendes, accidents, retrait de permis : bénéficiez d'un soutien juridique complet.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Droit du logement</h3>
                  <p>Litiges avec le propriétaire, augmentation de loyer, état des lieux : nous vous conseillons.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Droit contractuel</h3>
                  <p>Achats en ligne, garanties, litiges avec des prestataires : faites valoir vos droits.</p>
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

export default ProtectionJuridique;
