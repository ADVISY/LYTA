import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, Award, ChevronLeft, ChevronRight, Heart, Home, Car } from "lucide-react";
import familyConsultation from "@/assets/family-consultation.jpg";
import calculatorSavings from "@/assets/calculator-savings.jpg";
import teamExpertise from "@/assets/team-expertise.jpg";
import santéModerne from "@/assets/sante-moderne.jpg";
import menageModerne from "@/assets/menage-moderne.jpg";
import autoModerne from "@/assets/auto-moderne.jpg";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const slides = [
  {
    image: familyConsultation,
    icon: Shield,
    title: "Conseil personnalisé",
    subtitle: "Votre famille mérite la meilleure protection",
    description: "Des experts à votre écoute pour des solutions sur mesure",
  },
  {
    image: santéModerne,
    icon: Heart,
    title: "Assurance santé",
    subtitle: "Protégez votre santé et celle de vos proches",
    description: "Trouvez la meilleure couverture santé adaptée à vos besoins",
  },
  {
    image: calculatorSavings,
    icon: TrendingUp,
    title: "Optimisez vos coûts",
    subtitle: "Économisez jusqu'à 40% sur vos primes",
    description: "Calculateurs gratuits et comparaisons personnalisées",
  },
  {
    image: menageModerne,
    icon: Home,
    title: "RC & Ménage",
    subtitle: "Protégez votre foyer et vos biens",
    description: "Une couverture complète pour votre habitation",
  },
  {
    image: autoModerne,
    icon: Car,
    title: "Assurance auto",
    subtitle: "Roulez l'esprit tranquille",
    description: "Les meilleures offres pour votre véhicule",
  },
  {
    image: teamExpertise,
    icon: Award,
    title: "4 ans d'expérience",
    subtitle: "Plus de 2500 clients nous font confiance",
    description: "Accompagnement complet de A à Z",
  },
];

interface HeroSliderProps {
  onContactClick: () => void;
  onServicesClick: () => void;
}

export const HeroSlider = ({ onContactClick, onServicesClick }: HeroSliderProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000, stopOnInteraction: false }),
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

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

  return (
    <div className="relative overflow-hidden" ref={emblaRef}>
      <div className="flex">
        {slides.map((slide, index) => {
          const Icon = slide.icon;
          return (
            <div
              key={index}
              className="relative flex-[0_0_100%] min-w-0"
              style={{ minHeight: "600px" }}
            >
              {/* Background Image */}
              <div className="absolute inset-0">
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-background/70 via-background/60 to-primary/20" />
              </div>

              {/* Content */}
              <div className="relative z-10 h-full flex items-center">
                <div className="container mx-auto px-4 lg:px-8">
                  <div className="max-w-3xl animate-fade-in">
                    {/* Badge flottant */}
                    <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-white/95 backdrop-blur-xl border-2 border-primary/30 shadow-strong mb-6 sm:mb-8 animate-bounce-in hover:scale-105 transition-all duration-300">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow flex-shrink-0">
                        <Icon className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-base sm:text-xl font-bold text-foreground">
                          {slide.title}
                        </h3>
                        <p className="text-sm sm:text-base text-muted-foreground">
                          {slide.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-light text-foreground mb-8 sm:mb-10 leading-relaxed animate-slide-in-left drop-shadow-lg">
                      {slide.description}
                    </p>

                    {/* Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 animate-slide-in-right">
                      <Button
                        size="lg"
                        variant="premium"
                        onClick={onContactClick}
                        className="group"
                      >
                        <span className="relative z-10 font-bold">Prendre rendez-vous</span>
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={onServicesClick}
                        className="group"
                      >
                        <span className="font-semibold">Découvrir nos services</span>
                        <span className="ml-2 group-hover:translate-x-2 transition-transform text-lg">
                          →
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={scrollPrev}
        className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-20 w-14 h-14 rounded-full bg-white/95 backdrop-blur-sm border-2 border-primary/30 shadow-strong hover:shadow-glow hover:bg-white hover:scale-110 transition-all duration-300 flex items-center justify-center group"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-7 h-7 text-primary group-hover:scale-110 transition-transform" />
      </button>
      <button
        onClick={scrollNext}
        className="absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-20 w-14 h-14 rounded-full bg-white/95 backdrop-blur-sm border-2 border-primary/30 shadow-strong hover:shadow-glow hover:bg-white hover:scale-110 transition-all duration-300 flex items-center justify-center group"
        aria-label="Next slide"
      >
        <ChevronRight className="w-7 h-7 text-primary group-hover:scale-110 transition-transform" />
      </button>

      {/* Dots Indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-3 bg-black/30 backdrop-blur-md px-4 py-3 rounded-full">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => emblaApi && emblaApi.scrollTo(index)}
            className={`transition-all duration-300 rounded-full ${
              index === selectedIndex
                ? "w-10 h-3 bg-primary shadow-glow"
                : "w-3 h-3 bg-white/60 hover:bg-white/90 hover:scale-110"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
