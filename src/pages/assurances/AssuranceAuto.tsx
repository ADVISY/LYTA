import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Car, Shield, CheckCircle, AlertTriangle } from "lucide-react";
import { DevisForm } from "@/components/forms/DevisForm";
import autoModerne from "@/assets/auto-moderne.jpg";
import familyConsultation from "@/assets/family-consultation.jpg";
import clientHappy from "@/assets/client-happy.jpg";
import advisyTextLogo from "@/assets/advisy-text-logo.svg";
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const AssuranceAuto = () => {
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
      image: autoModerne,
      title: "Protection complète",
      description: "RC, casco partielle ou complète selon vos besoins",
    },
    {
      image: familyConsultation,
      title: "Conseil personnalisé",
      description: "Trouvez la couverture adaptée à votre véhicule",
    },
    {
      image: clientHappy,
      title: "Meilleur prix garanti",
      description: "Comparez et économisez sur votre assurance auto",
    },
  ];

  const couvertures = [
    {
      title: "RC Véhicules (obligatoire)",
      items: [
        "Dommages causés à des tiers",
        "Couverture illimitée en Suisse",
        "Validité internationale",
        "Protection juridique incluse",
      ],
    },
    {
      title: "Casco partielle (recommandée)",
      items: [
        "Vol et tentative de vol",
        "Bris de glaces",
        "Dommages naturels (grêle, inondation)",
        "Collision avec animaux",
        "Incendie et explosion",
      ],
    },
    {
      title: "Casco complète",
      items: [
        "Tous les risques casco partielle",
        "Dommages de collision",
        "Actes de vandalisme",
        "Dommages parking",
        "Valeur à neuf (option)",
      ],
    },
  ];

  const conseils = [
    {
      icon: Shield,
      title: "Franchise adaptée",
      description: "Choisissez la franchise qui correspond à votre utilisation et votre budget",
    },
    {
      icon: Car,
      title: "Assistance 24/7",
      description: "Dépannage et remorquage inclus dans nos solutions complètes",
    },
    {
      icon: AlertTriangle,
      title: "Protection bonus",
      description: "Protégez vos années sans sinistre avec notre option bonus-protégé",
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
                    <Car className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                      Assurance Auto
                    </span>
                  </div>
                  
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight">
                    Protégez votre véhicule avec{" "}
                    <span className="relative inline-block">
                      <span className="relative z-10 bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-transparent">
                        la meilleure couverture
                      </span>
                      <span className="absolute -bottom-2 left-0 w-full h-3 bg-primary/20 blur-sm" />
                    </span>
                  </h1>
                  
                  <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-light">
                    RC, casco partielle ou complète : trouvez l'assurance auto idéale
                    pour votre véhicule au meilleur prix.
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

        {/* Conseils Section */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Nos conseils pour bien vous assurer
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {conseils.map((conseil, index) => {
                  const Icon = conseil.icon;
                  return (
                    <div
                      key={index}
                      className="p-8 rounded-3xl border border-border bg-card hover:border-primary/50 transition-all duration-500 hover:shadow-glow hover:-translate-y-2"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mb-6 shadow-soft">
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-3">
                        {conseil.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {conseil.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Types de couverture */}
        <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Quelle couverture choisir ?
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  Comparez les différentes options pour trouver celle qui correspond à vos besoins
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {couvertures.map((couverture, index) => (
                  <div
                    key={index}
                    className="p-8 rounded-3xl bg-card border border-border shadow-soft hover:border-primary/50 transition-all duration-300"
                  >
                    <h3 className="text-xl font-bold text-foreground mb-6">
                      {couverture.title}
                    </h3>
                    <ul className="space-y-3">
                      {couverture.items.map((item, itemIndex) => (
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
                  Obtenez votre devis auto personnalisé
                </h2>
                <p className="text-lg text-muted-foreground">
                  Comparez les meilleures offres du marché en quelques minutes
                </p>
              </div>
              
              <DevisForm type="auto" title="Devis Assurance Auto" />
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default AssuranceAuto;