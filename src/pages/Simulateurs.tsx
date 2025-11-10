import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Calculator, Wallet, HeartHandshake, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimulateurImpot } from "@/components/simulateurs/SimulateurImpot";
import { SimulateurSalaire } from "@/components/simulateurs/SimulateurSalaire";
import { SimulateurSubsides } from "@/components/simulateurs/SimulateurSubsides";

const Simulateurs = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        {/* Hero Section */}
        <section className="relative py-20 bg-gradient-to-b from-primary/5 to-background overflow-hidden">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Calculator className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                  Outils de simulation
                </span>
              </div>
              
              <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
                Simulateurs Advisy : calculez, comprenez et{" "}
                <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
                  optimisez votre situation
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8">
                Des outils simples et intuitifs pour estimer vos impôts, votre salaire et vos droits à des aides sur vos primes santé.
              </p>
              
              <div className="bg-card border border-border rounded-2xl p-6 shadow-soft">
                <p className="text-foreground mb-4">
                  Chez Advisy, nous pensons que la clarté commence par la compréhension.
                  Ces trois simulateurs vous permettent d'obtenir en quelques secondes une estimation personnalisée, 
                  afin de prendre des décisions éclairées sur votre avenir financier et votre couverture d'assurance.
                </p>
                <p className="text-sm text-muted-foreground">
                  ⚠️ Ces outils sont fournis à titre indicatif. Pour une analyse complète et certifiée, contactez un conseiller Advisy.
                </p>
              </div>
            </div>
          </div>
        </section>

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
