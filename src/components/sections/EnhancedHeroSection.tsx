import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Calendar, CheckCircle, Sparkles, Award, Users } from "lucide-react";
import familyConsultation from "@/assets/family-consultation.jpg";
import calculatorSavings from "@/assets/calculator-savings.jpg";
import teamExpertise from "@/assets/team-expertise.jpg";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import advisyTextLogo from "@/assets/advisy-text-logo.svg";

export const EnhancedHeroSection = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 4000, stopOnInteraction: false }),
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollTo = useCallback(
    (index: number) => emblaApi && emblaApi.scrollTo(index),
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const slides = [
    {
      icon: Shield,
      title: "Conseil personnalisé",
      description: "Votre famille mérite la meilleure protection. Des experts à votre écoute.",
      image: familyConsultation,
    },
    {
      icon: TrendingUp,
      title: "Optimisez vos coûts",
      description: "Économisez jusqu'à 40% sur vos primes d'assurance avec nos comparaisons.",
      image: calculatorSavings,
    },
    {
      icon: Award,
      title: "15 ans d'expertise",
      description: "Plus de 500 clients nous font confiance. Accompagnement complet de A à Z.",
      image: teamExpertise,
    },
  ];

  return (
    <section
      id="accueil"
      className="relative min-h-screen flex items-center pt-20 overflow-hidden"
    >
      {/* Premium Light Overlay avec glassmorphism */}
      
      
      

      <div className="container relative z-10 mx-auto px-4 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left Column - Enhanced Text */}
          <div className="space-y-10 animate-fade-in">
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <img src={advisyTextLogo} alt="Advisy" className="h-16 md:h-20 lg:h-24 object-contain" />
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
                  La clarté dans vos décisions{" "}
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
              </div>
              
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-10 mt-6 border-t border-primary/20">
              <div className="space-y-2 p-3 sm:p-4 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:shadow-glow transition-all duration-500 hover:scale-105">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5 text-primary-glow" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary-light to-primary-glow bg-clip-text text-transparent">100%</p>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium text-center sm:text-left">Indépendant</p>
              </div>
              <div className="space-y-2 p-3 sm:p-4 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:shadow-glow transition-all duration-500 hover:scale-105">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary-glow" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary-light to-primary-glow bg-clip-text text-transparent">500+</p>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium text-center sm:text-left">Clients</p>
              </div>
              <div className="space-y-2 p-3 sm:p-4 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:shadow-glow transition-all duration-500 hover:scale-105">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary-glow" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary-light to-primary-glow bg-clip-text text-transparent">15+</p>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium text-center sm:text-left">Ans d'expertise</p>
              </div>
            </div>
          </div>

          {/* Right Column - Carousel Cards */}
          <div className="relative animate-scale-in">
            <div className="relative overflow-hidden rounded-[32px]" ref={emblaRef}>
              <div className="flex">
                {slides.map((slide, index) => {
                  const Icon = slide.icon;
                  return (
                    <div
                      key={index}
                      className="flex-[0_0_100%] min-w-0 px-2"
                    >
                      <div className="relative">
                        {/* Main card avec image */}
                        <div className="group relative z-20 rounded-[32px] overflow-hidden border-4 border-white/20 shadow-strong hover:shadow-[0_0_80px_rgba(100,50,255,0.5)] transition-all duration-700 hover:-translate-y-3 hover:border-primary/40">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-700 z-10" />
                          <img 
                            src={slide.image} 
                            alt={slide.title}
                            className="w-full h-full object-cover aspect-[4/3] group-hover:scale-105 transition-transform duration-700"
                          />
                          
                          {/* Badge flottant sur l'image */}
                          <div className="absolute bottom-6 left-6 right-6 z-20 bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-primary/20 shadow-strong">
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow flex-shrink-0 group-hover:scale-110 transition-transform">
                                <Icon className="w-8 h-8 text-white" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-foreground mb-1">
                                  {slide.title}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {slide.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Premium floating cards - hidden on mobile */}
                        <div className="hidden lg:block absolute -top-6 -right-6 z-10 w-56 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl rounded-3xl p-7 border-2 border-primary/20 shadow-strong hover:shadow-glow transition-all duration-500 hover:-translate-y-2 hover:border-primary/50 hover:scale-105">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-5 shadow-soft">
                            <TrendingUp className="w-7 h-7 text-primary-glow" />
                          </div>
                          <h4 className="font-bold text-foreground mb-2 text-lg">Optimisation</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Meilleur rapport qualité-prix
                          </p>
                        </div>

                        <div className="hidden lg:block absolute -bottom-6 -left-6 z-10 w-56 bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl rounded-3xl p-7 border-2 border-primary/20 shadow-strong hover:shadow-glow transition-all duration-500 hover:-translate-y-2 hover:border-primary/50 hover:scale-105">
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
                  );
                })}
              </div>
            </div>

            {/* Dots Indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollTo(index)}
                  className={`transition-all duration-300 rounded-full ${
                    index === selectedIndex
                      ? "w-8 h-3 bg-primary shadow-glow"
                      : "w-3 h-3 bg-muted-foreground/40 hover:bg-muted-foreground/60"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};
