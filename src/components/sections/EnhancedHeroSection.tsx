import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Calendar, CheckCircle, Sparkles, Award, Users } from "lucide-react";
import heroBg from "@/assets/hero-bg.png";
import familyConsultation from "@/assets/family-consultation.jpg";

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
      {/* Premium Light Overlay avec glassmorphism */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/85 to-primary/5 backdrop-blur-sm" />
      
      {/* Advanced Premium Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-20 right-10 w-[700px] h-[700px] bg-gradient-to-br from-primary-glow/15 to-accent/15 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/8 rounded-full blur-[160px]" />
      </div>
      
      {/* Mesh gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(100,50,255,0.03),transparent_50%)]" />

      <div className="container relative z-10 mx-auto px-4 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left Column - Enhanced Text */}
          <div className="space-y-10 animate-fade-in">
            {/* Premium Badge avec glow effect */}
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 border border-primary/40 backdrop-blur-md shadow-glow hover:shadow-[0_0_60px_rgba(100,50,255,0.4)] transition-all duration-500 hover:scale-105">
              <Sparkles className="w-5 h-5 text-primary-glow animate-pulse" />
              <span className="text-sm font-bold text-primary-glow tracking-wide">
                Conseil indépendant en Suisse
              </span>
            </div>

            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight">
                Advisy : la clarté dans vos décisions{" "}
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-transparent">
                    d'assurance
                  </span>
                  <span className="absolute -bottom-2 left-0 w-full h-3 bg-primary/20 blur-sm" />
                </span>{" "}
                et de{" "}
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-transparent">
                    prévoyance
                  </span>
                  <span className="absolute -bottom-2 left-0 w-full h-3 bg-primary/20 blur-sm" />
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-light">
                Trouvez la solution la plus avantageuse pour votre santé, votre retraite et vos finances.{" "}
                <span className="text-foreground font-medium">
                  Nos conseillers indépendants vous accompagnent gratuitement dans toute la Suisse.
                </span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-5">
              <Button
                size="lg"
                variant="premium"
                onClick={() => scrollToSection("#contact")}
                className="group"
              >
                <Calendar className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                <span className="relative z-10 font-bold">Prendre rendez-vous</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToSection("#services")}
                className="group"
              >
                <span className="font-semibold">Découvrir nos services</span>
                <span className="ml-2 group-hover:translate-x-2 transition-transform text-lg">
                  →
                </span>
              </Button>
            </div>

            {/* Premium Trust Indicators avec glassmorphism */}
            <div className="grid grid-cols-3 gap-6 pt-10 mt-6 border-t border-primary/20">
              <div className="space-y-2 p-4 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:shadow-glow transition-all duration-500 hover:scale-105">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Award className="w-5 h-5 text-primary-glow" />
                  </div>
                  <p className="text-3xl font-bold bg-gradient-to-r from-primary-light to-primary-glow bg-clip-text text-transparent">100%</p>
                </div>
                <p className="text-sm text-muted-foreground font-medium">Indépendant</p>
              </div>
              <div className="space-y-2 p-4 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:shadow-glow transition-all duration-500 hover:scale-105">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary-glow" />
                  </div>
                  <p className="text-3xl font-bold bg-gradient-to-r from-primary-light to-primary-glow bg-clip-text text-transparent">500+</p>
                </div>
                <p className="text-sm text-muted-foreground font-medium">Clients</p>
              </div>
              <div className="space-y-2 p-4 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:shadow-glow transition-all duration-500 hover:scale-105">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-primary-glow" />
                  </div>
                  <p className="text-3xl font-bold bg-gradient-to-r from-primary-light to-primary-glow bg-clip-text text-transparent">15+</p>
                </div>
                <p className="text-sm text-muted-foreground font-medium">Ans d'expertise</p>
              </div>
            </div>
          </div>

          {/* Right Column - Image de consultation familiale */}
          <div className="relative animate-scale-in">
            <div className="relative">
              {/* Image principale de consultation */}
              <div className="group relative z-20 rounded-[32px] overflow-hidden border-4 border-white/20 shadow-strong hover:shadow-[0_0_80px_rgba(100,50,255,0.5)] transition-all duration-700 hover:-translate-y-3 hover:border-primary/40">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-700 z-10" />
                <img 
                  src={familyConsultation} 
                  alt="Famille en consultation avec un conseiller Advisy"
                  className="w-full h-full object-cover aspect-[4/3] group-hover:scale-105 transition-transform duration-700"
                />
                
                {/* Badge flottant sur l'image */}
                <div className="absolute bottom-6 left-6 right-6 z-20 bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-primary/20 shadow-strong">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow flex-shrink-0">
                      <Shield className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-1">
                        Conseil personnalisé
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Votre famille mérite la meilleure protection
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Premium floating cards */}
              <div className="absolute -top-6 -right-6 z-10 w-56 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl rounded-3xl p-7 border-2 border-primary/20 shadow-strong hover:shadow-glow transition-all duration-500 hover:-translate-y-2 hover:border-primary/50 hover:scale-105">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-5 shadow-soft">
                  <TrendingUp className="w-7 h-7 text-primary-glow" />
                </div>
                <h4 className="font-bold text-foreground mb-2 text-lg">Optimisation</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Meilleur rapport qualité-prix
                </p>
              </div>

              <div className="absolute -bottom-6 -left-6 z-10 w-56 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl rounded-3xl p-7 border-2 border-primary/20 shadow-strong hover:shadow-glow transition-all duration-500 hover:-translate-y-2 hover:border-primary/50 hover:scale-105">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-5 shadow-soft">
                  <Calendar className="w-7 h-7 text-primary-glow" />
                </div>
                <h4 className="font-bold text-foreground mb-2 text-lg">Prévoyance</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Planification long terme
                </p>
              </div>

              {/* Enhanced decorative glow effects */}
              <div className="absolute -top-16 -right-16 w-80 h-80 bg-gradient-to-br from-primary/15 to-primary-glow/10 rounded-full blur-[120px] -z-10 animate-float" />
              <div className="absolute -bottom-16 -left-16 w-96 h-96 bg-gradient-to-tl from-accent/20 to-primary/10 rounded-full blur-[140px] -z-10 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};
