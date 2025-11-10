import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Calendar, CheckCircle, Sparkles, Award, Users } from "lucide-react";
import heroBg from "@/assets/hero-bg.png";

export const EnhancedHeroSection = () => {
  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      id="accueil"
      className="relative min-h-screen flex items-center pt-20 overflow-hidden"
      style={{
        backgroundImage: `url(${heroBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay subtil pour améliorer la lisibilité */}
      <div className="absolute inset-0 bg-background/30" />
      
      {/* Advanced Background effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-accent blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left Column - Enhanced Text */}
          <div className="space-y-10 animate-fade-in">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">
                Conseil indépendant en Suisse
              </span>
            </div>

            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight">
                Votre copilote pour vos{" "}
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-transparent">
                    assurances
                  </span>
                  <span className="absolute -bottom-2 left-0 w-full h-3 bg-primary/20 blur-sm" />
                </span>{" "}
                et{" "}
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-transparent">
                    finances
                  </span>
                  <span className="absolute -bottom-2 left-0 w-full h-3 bg-primary/20 blur-sm" />
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-light">
                Analyse complète de votre situation, optimisation de vos
                assurances et de votre prévoyance.{" "}
                <span className="text-foreground font-medium">
                  En toute indépendance.
                </span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                onClick={() => scrollToSection("#contact")}
                className="text-base shadow-glow group relative overflow-hidden"
              >
                <span className="relative z-10">Prendre rendez-vous</span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary-light to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToSection("#services")}
                className="text-base border-2 group"
              >
                Découvrir nos services
                <span className="ml-2 group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  <p className="text-2xl font-bold text-foreground">100%</p>
                </div>
                <p className="text-sm text-muted-foreground">Indépendant</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <p className="text-2xl font-bold text-foreground">500+</p>
                </div>
                <p className="text-sm text-muted-foreground">Clients</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <p className="text-2xl font-bold text-foreground">15+</p>
                </div>
                <p className="text-sm text-muted-foreground">Ans d'expertise</p>
              </div>
            </div>
          </div>

          {/* Right Column - Advanced 3D Card Layout */}
          <div className="relative animate-scale-in">
            <div className="relative">
              {/* Main feature card */}
              <div className="relative z-20 bg-gradient-card backdrop-blur-sm rounded-3xl p-8 border border-border shadow-strong hover:shadow-glow transition-all duration-500 hover:-translate-y-2">
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-medium">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-foreground mb-3">
                      Protection complète
                    </h3>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      Analyse approfondie de toutes vos couvertures d'assurance
                      et recommandations personnalisées.
                    </p>
                    <div className="flex items-center gap-2 text-primary font-semibold">
                      <span>En savoir plus</span>
                      <span className="group-hover:translate-x-1 transition-transform">
                        →
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating cards */}
              <div className="absolute -top-6 -right-6 z-10 w-48 bg-card backdrop-blur-sm rounded-2xl p-6 border border-border shadow-medium hover:shadow-strong transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-bold text-foreground mb-2">Optimisation</h4>
                <p className="text-sm text-muted-foreground">
                  Meilleur rapport qualité-prix
                </p>
              </div>

              <div className="absolute -bottom-6 -left-6 z-10 w-48 bg-card backdrop-blur-sm rounded-2xl p-6 border border-border shadow-medium hover:shadow-strong transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-bold text-foreground mb-2">Prévoyance</h4>
                <p className="text-sm text-muted-foreground">
                  Planification long terme
                </p>
              </div>

              {/* Decorative glow effects */}
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse" />
              <div className="absolute -bottom-12 -left-12 w-72 h-72 bg-accent blur-3xl -z-10" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};
