import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { HeartHandshake, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimulateurImpot } from "@/components/simulateurs/SimulateurImpot";
import { SimulateurSalaire } from "@/components/simulateurs/SimulateurSalaire";
import { SimulateurSubsides } from "@/components/simulateurs/SimulateurSubsides";
import { SimulateursSlider } from "@/components/sections/SimulateursSlider";

const Simulateurs = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        {/* Hero Slider Section */}
        <SimulateursSlider />

        {/* Simulateurs */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-6xl mx-auto space-y-12">
              {/* Simulateur d'impôt */}
              <SimulateurImpot />
              
              {/* Simulateur de salaire */}
              <SimulateurSalaire />
              
              {/* Simulateur de subsides */}
              <SimulateurSubsides />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-b from-muted/30 to-background">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <HeartHandshake className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                  Accompagnement
                </span>
              </div>
              
              <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-6">
                🧭 Besoin d'aide pour interpréter vos résultats ?
              </h2>
              
              <p className="text-lg text-muted-foreground mb-8">
                Ces outils donnent une première estimation, mais seule une analyse complète permet de définir la stratégie optimale.
                Nos conseillers Advisy vous accompagnent pour vérifier vos résultats, trouver des solutions concrètes et optimiser votre situation à long terme.
              </p>
              
              <Button size="lg" className="gap-2" asChild>
                <a href="#contact">
                  💬 Parler à un conseiller Advisy
                  <ArrowRight className="w-5 h-5" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Simulateurs;
