import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Landmark, TrendingDown, Shield, CheckCircle } from "lucide-react";
import { DevisForm } from "@/components/forms/DevisForm";
import hypothequeModerne from "@/assets/hypotheque-moderne.jpg";
import familyConsultation from "@/assets/family-consultation.jpg";
import clientHappy from "@/assets/client-happy.jpg";
import advisyTextLogo from "@/assets/advisy-text-logo.svg";
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const Hypotheque = () => {
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
      image: hypothequeModerne,
      title: "Taux avantageux",
      description: "Les meilleures conditions du marché pour votre projet",
    },
    {
      image: familyConsultation,
      title: "Accompagnement complet",
      description: "De la simulation au financement de votre bien",
    },
    {
      image: clientHappy,
      title: "Flexibilité garantie",
      description: "Solutions sur mesure adaptées à votre situation",
    },
  ];

  const solutions = [
    {
      title: "Hypothèque fixe",
      items: ["Taux fixe de 2 à 15 ans", "Budget prévisible", "Protection contre hausse des taux", "Idéal pour stabilité"],
    },
    {
      title: "Hypothèque SARON",
      items: ["Taux variable compétitif", "Flexibilité maximale", "Suit le marché", "Économies potentielles"],
    },
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
          <div className="container relative z-10 mx-auto px-4 lg:px-8 py-20 lg:py-32">
            <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
              {/* Left Column */}
              <div className="space-y-10 animate-fade-in">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                    <Landmark className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                      Hypothèque
                    </span>
                  </div>
                  
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight">
                    Réalisez votre projet{" "}
                    <span className="relative inline-block">
                      <span className="relative z-10 bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-transparent">
                        immobilier
                      </span>
                      <span className="absolute -bottom-2 left-0 w-full h-3 bg-primary/20 blur-sm" />
                    </span>
                  </h1>
                  
                  <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-light">
                    Les meilleures conditions hypothécaires pour votre bien immobilier
                  </p>
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

        <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <div className="grid md:grid-cols-2 gap-8 mb-16">
                {solutions.map((solution, index) => (
                  <div key={index} className="p-8 rounded-3xl bg-card border border-border shadow-soft">
                    <h3 className="text-xl font-bold text-foreground mb-6">{solution.title}</h3>
                    <ul className="space-y-3">
                      {solution.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
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

        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <DevisForm type="hypotheque" title="Simulation Hypothécaire Gratuite" />
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Hypotheque;