import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { Shield, Building, CheckCircle } from "lucide-react";
import lppEntreprise from "@/assets/lpp-entreprise.jpg";
import teamMeeting from "@/assets/team-meeting.jpg";
import clientHappy from "@/assets/client-happy.jpg";
import advisyTextLogo from "@/assets/advisy-text-logo.svg";
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const PrevoyanceLPP = () => {
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

  const slides = [
    {
      image: lppEntreprise,
      title: "Prévoyance optimale",
      description: "2e pilier adapté à votre entreprise",
    },
    {
      image: teamMeeting,
      title: "Comparaison des caisses",
      description: "Les meilleures fondations LPP du marché",
    },
    {
      image: clientHappy,
      title: "Gestion simplifiée",
      description: "Administration et suivi de vos contrats",
    },
  ];

  const solutions = [
    {
      title: "Comparaison des caisses",
      description: "Nous analysons les meilleures fondations LPP selon vos critères : prestations, coûts, flexibilité.",
      items: ["Analyse comparative", "Meilleures conditions", "Solutions flexibles", "Accompagnement complet"],
    },
    {
      title: "Plans surobligatoires",
      description: "Offrez à vos collaborateurs une prévoyance supérieure au minimum légal pour les fidéliser.",
      items: ["Prestations étendues", "Attractivité employeur", "Salaire assuré supérieur", "Options personnalisées"],
    },
    {
      title: "Gestion simplifiée",
      description: "Accompagnement dans la mise en place, l'administration et les mutations de personnel.",
      items: ["Installation complète", "Administration facilitée", "Mutations simplifiées", "Support continu"],
    },
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
          <div className="container relative z-10 mx-auto px-4 lg:px-8 py-20 lg:py-32">
            <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
              <div className="space-y-10 animate-fade-in">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                    <Building className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                      Entreprises
                    </span>
                  </div>
                  
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight">
                    Prévoyance{" "}
                    <span className="relative inline-block">
                      <span className="relative z-10 bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-transparent">
                        professionnelle (LPP)
                      </span>
                      <span className="absolute -bottom-2 left-0 w-full h-3 bg-primary/20 blur-sm" />
                    </span>
                  </h1>
                  
                  <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-light">
                    Choisissez la caisse de pension adaptée à votre taille et votre budget.
                  </p>
                </div>

                <Button size="lg" onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}>
                  Optimisez votre LPP
                </Button>
              </div>

              <div className="relative animate-scale-in">
                <div className="relative overflow-hidden rounded-[32px]" ref={emblaRef}>
                  <div className="flex">
                    {slides.map((slide, index) => (
                      <div key={index} className="flex-[0_0_100%] min-w-0 px-2">
                        <div className="relative">
                          <div className="group relative z-20 rounded-[32px] overflow-hidden border-4 border-white/20 shadow-strong hover:shadow-glow transition-all duration-700 hover:-translate-y-3">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-700 z-10" />
                            <img 
                              src={slide.image} 
                              alt={slide.title}
                              className="w-full h-full object-cover aspect-[4/3] group-hover:scale-105 transition-transform duration-700"
                            />
                            
                            <div className="absolute bottom-6 left-6 right-6 z-20 bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-primary/20 shadow-strong">
                              <h3 className="text-2xl font-bold text-foreground mb-2">
                                {slide.title}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {slide.description}
                              </p>
                            </div>
                          </div>

                          <div className="absolute -top-16 -right-16 w-80 h-80 bg-gradient-to-br from-primary/15 to-primary-glow/10 rounded-full blur-[120px] -z-10 animate-float" />
                          <div className="absolute -bottom-16 -left-16 w-96 h-96 bg-gradient-to-tl from-accent/20 to-primary/10 rounded-full blur-[140px] -z-10 animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

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
                      aria-label={`Aller à la slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 flex flex-wrap items-center justify-center gap-3">
                  <span>Prévoyance professionnelle sur mesure avec</span>
                  <img src={advisyTextLogo} alt="Advisy" className="h-10 md:h-12 object-contain inline-block" />
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {solutions.map((solution, index) => (
                  <div
                    key={index}
                    className="p-8 rounded-3xl bg-card border border-border shadow-soft hover:border-primary/50 transition-all duration-300"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mb-6 shadow-soft">
                      <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-3">
                      {solution.title}
                    </h3>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      {solution.description}
                    </p>
                    <ul className="space-y-3">
                      {solution.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default PrevoyanceLPP;
