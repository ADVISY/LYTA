import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Home, Shield, CheckCircle, Heart } from "lucide-react";
import { DevisForm } from "@/components/forms/DevisForm";
import menageModerne from "@/assets/menage-moderne.jpg";
import familyConsultation from "@/assets/family-consultation.jpg";
import clientHappy from "@/assets/client-happy.jpg";
import advisyTextLogo from "@/assets/advisy-text-logo.svg";
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const AssuranceRCMenage = () => {
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
      image: menageModerne,
      title: "Protection du foyer",
      description: "Vos biens et votre responsabilité couverts",
    },
    {
      image: familyConsultation,
      title: "Toute la famille protégée",
      description: "Enfants et animaux domestiques inclus",
    },
    {
      image: clientHappy,
      title: "Sérénité au quotidien",
      description: "Protection complète contre tous les risques",
    },
  ];

  const garanties = [
    {
      title: "Responsabilité Civile Privée",
      items: [
        "Dommages corporels causés à des tiers",
        "Dommages matériels causés à autrui",
        "Protection de toute la famille",
        "Couverture internationale",
        "Enfants et animaux domestiques inclus",
      ],
    },
    {
      title: "Assurance Ménage",
      items: [
        "Vol et cambriolage",
        "Incendie et explosion",
        "Dégâts d'eau et inondations",
        "Bris de glaces",
        "Catastrophes naturelles",
      ],
    },
    {
      title: "Extensions possibles",
      items: [
        "Objets de valeur (bijoux, œuvres d'art)",
        "Vélos électriques",
        "Instruments de musique",
        "Électronique portable",
        "Assurance tous risques",
      ],
    },
  ];

  const avantages = [
    {
      icon: Shield,
      title: "Protection complète",
      description: "Couvrez tous les risques du quotidien avec une seule police",
    },
    {
      icon: Heart,
      title: "Toute la famille",
      description: "Protection automatique pour tous les membres de votre foyer",
    },
    {
      icon: Home,
      title: "Biens assurés",
      description: "Mobilier, électroménager et objets personnels protégés",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        {/* Hero Section with Slider */}
        <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
          <div className="container relative z-10 mx-auto px-4 lg:px-8 py-20 lg:py-32">
            <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
              {/* Left Column */}
              <div className="space-y-10 animate-fade-in">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                    <Home className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                      RC & Assurance Ménage
                    </span>
                  </div>
                  
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight">
                    Protégez vos biens et votre{" "}
                    <span className="relative inline-block">
                      <span className="relative z-10 bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-transparent">
                        responsabilité
                      </span>
                      <span className="absolute -bottom-2 left-0 w-full h-3 bg-primary/20 blur-sm" />
                    </span>
                  </h1>
                  
                  <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-light">
                    RC privée et assurance ménage : deux protections essentielles
                    pour sécuriser votre quotidien et celui de votre famille.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:shadow-glow transition-all duration-500">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mb-2">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">100%</p>
                    <p className="text-xs text-muted-foreground">Protection</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:shadow-glow transition-all duration-500">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mb-2">
                      <Heart className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">24/7</p>
                    <p className="text-xs text-muted-foreground">Assistance</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:shadow-glow transition-all duration-500">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mb-2">
                      <Home className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">0</p>
                    <p className="text-xs text-muted-foreground">Franchise</p>
                  </div>
                </div>
              </div>

              {/* Right Column - Carousel */}
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

        {/* Avantages Section */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Pourquoi ces assurances sont indispensables ?
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {avantages.map((avantage, index) => {
                  const Icon = avantage.icon;
                  return (
                    <div
                      key={index}
                      className="p-8 rounded-3xl border border-border bg-card hover:border-primary/50 transition-all duration-500 hover:shadow-glow hover:-translate-y-2"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mb-6 shadow-soft">
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-3">
                        {avantage.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {avantage.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Garanties Section */}
        <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Nos garanties complètes
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  Des solutions adaptées à tous vos besoins de protection
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {garanties.map((garantie, index) => (
                  <div
                    key={index}
                    className="p-8 rounded-3xl bg-card border border-border shadow-soft hover:border-primary/50 transition-all duration-300"
                  >
                    <h3 className="text-xl font-bold text-foreground mb-6">
                      {garantie.title}
                    </h3>
                    <ul className="space-y-3">
                      {garantie.items.map((item, itemIndex) => (
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

        {/* Devis Section */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Demandez votre devis RC & Ménage
                </h2>
                <p className="text-lg text-muted-foreground">
                  Obtenez une protection complète au meilleur prix
                </p>
              </div>
              
              <DevisForm type="rc-menage" title="Devis RC & Assurance Ménage" />
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default AssuranceRCMenage;