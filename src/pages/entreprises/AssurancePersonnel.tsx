import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

const AssurancePersonnel = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-gradient-subtle">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <Users className="w-16 h-16 mx-auto text-primary" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Assurance du personnel
              </h1>
              <p className="text-lg md:text-xl text-foreground/80 max-w-3xl mx-auto leading-relaxed">
                Protégez vos employés et renforcez la confiance au sein de votre entreprise.
              </p>
              <Button size="lg" className="mt-8" onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}>
                Demandez une offre entreprise
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto prose prose-lg">
              <h2 className="text-3xl font-bold mb-6">Nos solutions pour entreprises</h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">Assurance accidents LAA</h3>
                  <p>Couverture obligatoire des accidents professionnels et non professionnels de vos collaborateurs.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Assurance maladie collective</h3>
                  <p>Conditions avantageuses pour vos employés et simplification administrative pour votre entreprise.</p>
                </div>

                <div>
                  <h3 className="text-2xl font-semibold mb-3">Prestations surobligatoires</h3>
                  <p>Renforcez l'attractivité de votre entreprise avec des couvertures supérieures au minimum légal.</p>
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

export default AssurancePersonnel;
