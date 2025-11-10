import { useState, useEffect, useCallback } from "react";
import { Calculator, Wallet, HeartHandshake } from "lucide-react";
import simulateurImpotHero from "@/assets/simulateur-impot-hero.jpg";
import simulateurSalaireHero from "@/assets/simulateur-salaire-hero.jpg";
import simulateurSubsidesHero from "@/assets/simulateur-subsides-hero.jpg";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import advisyTextLogo from "@/assets/advisy-text-logo.svg";

export const SimulateursSlider = () => {
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
      icon: Calculator,
      title: "Simulateur d'impôt",
      subtitle: "Optimisez vos cotisations 3ᵉ pilier",
      description: "Calculez en quelques clics l'économie d'impôt que vous pourriez réaliser en cotisant à un 3ᵉ pilier. Un outil simple pour comprendre les avantages fiscaux de la prévoyance.",
      image: simulateurImpotHero,
    },
    {
      icon: Wallet,
      title: "Simulateur de salaire",
      subtitle: "Du brut au net en un instant",
      description: "Découvrez votre salaire net après déduction des cotisations sociales et impôts. Comprenez où va votre argent et planifiez votre budget en toute clarté.",
      image: simulateurSalaireHero,
    },
    {
      icon: HeartHandshake,
      title: "Simulateur de subsides",
      subtitle: "Réduisez vos primes d'assurance",
      description: "Vérifiez si vous êtes éligible à des subsides cantonaux pour alléger vos primes d'assurance maladie. Une aide précieuse pour optimiser votre budget santé.",
      image: simulateurSubsidesHero,
    },
  ];

  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      <div className="container relative z-10 mx-auto px-4 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left Column - Text */}
          <div className="space-y-10 animate-fade-in">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-2">
                <Calculator className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                  Outils de simulation
                </span>
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight flex flex-wrap items-center gap-3">
                <span>Simulateurs</span>
                <img src={advisyTextLogo} alt="Advisy" className="h-12 md:h-14 lg:h-16 object-contain inline-block" />
                <span>: calculez, comprenez et{" "}</span>
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-transparent">
                    optimisez votre situation
                  </span>
                  <span className="absolute -bottom-2 left-0 w-full h-3 bg-primary/20 blur-sm" />
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-light">
                Des outils simples et intuitifs pour estimer vos impôts, votre salaire et vos droits à des aides sur vos primes santé.
              </p>
            </div>

          </div>

          {/* Right Column - Slider */}
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
                            className="w-full h-full object-cover aspect-[16/9] group-hover:scale-105 transition-transform duration-700"
                          />
                          
                          {/* Badge flottant sur l'image */}
                          <div className="absolute bottom-6 left-6 right-6 z-20 bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-primary/20 shadow-strong">
                            <div className="flex items-start gap-4">
                              <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow flex-shrink-0 group-hover:scale-110 transition-transform">
                                <Icon className="w-8 h-8 text-white" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-2xl font-bold text-foreground mb-1">
                                  {slide.title}
                                </h3>
                                <p className="text-sm font-semibold text-primary mb-2">
                                  {slide.subtitle}
                                </p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {slide.description}
                                </p>
                              </div>
                            </div>
                          </div>
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
                  aria-label={`Aller au simulateur ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Info Box - Full Width Below */}
        <div className="max-w-6xl mx-auto mt-16 bg-card border border-border rounded-2xl p-6 shadow-soft">
          <p className="text-foreground mb-4 flex flex-wrap items-center gap-2">
            <span>Chez</span>
            <img src={advisyTextLogo} alt="Advisy" className="h-5 inline-block" />
            <span>, nous pensons que la clarté commence par la compréhension. Ces trois simulateurs vous permettent d'obtenir en quelques secondes une estimation personnalisée, afin de prendre des décisions éclairées sur votre avenir financier et votre couverture d'assurance.</span>
          </p>
          <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
            <span>⚠️ Ces outils sont fournis à titre indicatif. Pour une analyse complète et certifiée, contactez un conseiller</span>
            <img src={advisyTextLogo} alt="Advisy" className="h-4 inline-block" />
          </p>
        </div>
      </div>
      
      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};
