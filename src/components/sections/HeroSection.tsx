import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Calendar, CheckCircle } from "lucide-react";

export const HeroSection = () => {
  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      id="accueil"
      className="min-h-screen flex items-center pt-20 bg-gradient-subtle"
    >
      <div className="container mx-auto px-4 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Text */}
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Votre copilote pour vos{" "}
                <span className="text-primary">assurances et finances</span> en
                Suisse.
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                Advisy vous aide à faire les bons choix, à chaque fois : analyse
                de votre situation, optimisation de vos assurances et de votre
                prévoyance, le tout en toute indépendance.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                onClick={() => scrollToSection("#contact")}
                className="text-base"
              >
                Prendre rendez-vous
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToSection("#services")}
                className="text-base"
              >
                Découvrir nos services
              </Button>
            </div>

            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
              <p>
                Conseils personnalisés pour particuliers et indépendants en
                Suisse romande.
              </p>
            </div>
          </div>

          {/* Right Column - Abstract Illustration */}
          <div className="relative animate-scale-in">
            <div className="grid grid-cols-2 gap-4">
              {/* Card 1 */}
              <div className="bg-card rounded-2xl p-6 shadow-medium hover:shadow-strong transition-all duration-300 hover:-translate-y-2 border border-border">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  Protection
                </h3>
                <p className="text-sm text-muted-foreground">
                  Analyse complète de vos couvertures
                </p>
              </div>

              {/* Card 2 */}
              <div className="bg-card rounded-2xl p-6 shadow-medium hover:shadow-strong transition-all duration-300 hover:-translate-y-2 border border-border mt-8">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  Optimisation
                </h3>
                <p className="text-sm text-muted-foreground">
                  Meilleur rapport qualité-prix
                </p>
              </div>

              {/* Card 3 */}
              <div className="bg-card rounded-2xl p-6 shadow-medium hover:shadow-strong transition-all duration-300 hover:-translate-y-2 border border-border">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  Prévoyance
                </h3>
                <p className="text-sm text-muted-foreground">
                  Planification de votre avenir
                </p>
              </div>

              {/* Card 4 */}
              <div className="bg-gradient-primary rounded-2xl p-6 shadow-strong text-white hover:scale-105 transition-all duration-300 mt-8">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="font-semibold mb-2">Indépendance</h3>
                <p className="text-sm text-white/90">
                  Conseils 100% objectifs
                </p>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl -z-10" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent blur-3xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
};
