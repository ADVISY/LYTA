import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Eye, Users, MapPin, Target, Heart, Shield, Award, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import officeImage from "@/assets/office-consultation.jpg";
import teamImage from "@/assets/team-meeting.jpg";
import familyConsultation from "@/assets/family-consultation.jpg";
import advisorWoman from "@/assets/advisor-woman.jpg";
import advisorMan from "@/assets/advisor-man.jpg";
import advisyTextLogo from "@/assets/advisy-text-logo.svg";
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const APropos = () => {
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
      image: familyConsultation,
      title: "Proximité humaine",
      description: "Nos conseillers vous accompagnent avec empathie et professionnalisme",
    },
    {
      image: advisorWoman,
      title: "Expertise reconnue",
      description: "Une équipe formée pour vous offrir les meilleures solutions",
    },
    {
      image: advisorMan,
      title: "Engagement qualité",
      description: "Votre satisfaction est notre priorité absolue",
    },
  ];

  const values = [
    {
      icon: Eye,
      title: "Transparence",
      description: "Nous expliquons chaque détail pour que vous compreniez vos choix. Pas de jargon complexe, uniquement des informations claires.",
    },
    {
      icon: Users,
      title: "Indépendance",
      description: "Aucun lien exclusif avec une compagnie, uniquement votre intérêt. Nous comparons l'ensemble du marché suisse pour vous.",
    },
    {
      icon: MapPin,
      title: "Proximité",
      description: "Présents partout en Suisse romande pour vous accompagner. Rencontres en personne ou à distance selon vos préférences.",
    },
  ];

  const stats = [
    { 
      icon: Award, 
      value: "2500+", 
      label: "Clients satisfaits", 
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      glowColor: "shadow-[0_0_30px_rgba(239,68,68,0.4)]",
      hoverGlow: "group-hover:shadow-[0_0_60px_rgba(239,68,68,0.6)]",
      iconColor: "text-red-500"
    },
    { 
      icon: TrendingUp, 
      value: "4", 
      label: "Années d'expérience", 
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      glowColor: "shadow-[0_0_30px_rgba(59,130,246,0.4)]",
      hoverGlow: "group-hover:shadow-[0_0_60px_rgba(59,130,246,0.6)]",
      iconColor: "text-blue-500"
    },
    { 
      icon: Shield, 
      value: "93%", 
      label: "Taux de satisfaction", 
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      glowColor: "shadow-[0_0_30px_rgba(34,197,94,0.4)]",
      hoverGlow: "group-hover:shadow-[0_0_60px_rgba(34,197,94,0.6)]",
      iconColor: "text-green-500",
      animated: true
    },
    { 
      icon: Clock, 
      value: "24h", 
      label: "Délai de réponse", 
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      glowColor: "shadow-[0_0_30px_rgba(168,85,247,0.4)]",
      hoverGlow: "group-hover:shadow-[0_0_60px_rgba(168,85,247,0.6)]",
      iconColor: "text-purple-500"
    },
  ];

  const expertise = [
    {
      title: "Analyse personnalisée",
      description: "Chaque situation est unique. Nous prenons le temps d'analyser votre profil, vos objectifs et vos besoins pour vous proposer des solutions sur mesure.",
    },
    {
      title: "Accompagnement continu",
      description: "Nous ne disparaissons pas après la signature. Votre conseiller reste à vos côtés pour adapter vos contrats à l'évolution de votre vie.",
    },
    {
      title: "Veille du marché",
      description: "Le monde de l'assurance évolue constamment. Nous surveillons les nouveautés et optimisons régulièrement vos contrats pour garantir le meilleur rapport qualité-prix.",
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
              {/* Left Column - Text */}
              <div className="space-y-10 animate-fade-in">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                    <Heart className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                      À propos
                    </span>
                  </div>
                  
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight flex flex-wrap items-center gap-4">
                    <span>Découvrez</span>
                    <img src={advisyTextLogo} alt="Advisy" className="h-14 md:h-16 lg:h-20 object-contain inline-block" />
                  </h1>
                  
                  <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-light flex flex-wrap items-center gap-2">
                    <img src={advisyTextLogo} alt="Advisy" className="h-6 inline-block" />
                    <span>a pour mission d'apporter de la clarté, de la transparence et de la stratégie dans le monde de l'assurance et de la prévoyance.</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border/50">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Eye className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">Transparence</h3>
                      <p className="text-sm text-muted-foreground">Clarté totale dans nos conseils</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border/50">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">Indépendance</h3>
                      <p className="text-sm text-muted-foreground">Votre intérêt avant tout</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border/50">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">Proximité</h3>
                      <p className="text-sm text-muted-foreground">Présents en Suisse romande</p>
                    </div>
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

        {/* Mission Section with Image */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <div className="space-y-6">
                <div className="inline-block px-4 py-2 bg-primary/10 rounded-full">
                  <span className="text-primary font-semibold">Notre Vision</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  Rendre l'assurance simple et accessible
                </h2>
                <p className="text-lg text-foreground/70 leading-relaxed flex flex-wrap items-center gap-2">
                  <span>Trop souvent, l'assurance et la prévoyance sont perçues comme complexes et opaques. Chez</span>
                  <img src={advisyTextLogo} alt="Advisy" className="h-5 inline-block" />
                  <span>, nous croyons qu'il est possible de faire autrement.</span>
                </p>
                <p className="text-lg text-foreground/70 leading-relaxed">
                  Notre mission est de démystifier le secteur, d'offrir des conseils personnalisés et indépendants, 
                  et de vous accompagner dans toutes les étapes de votre vie avec des solutions adaptées à vos besoins réels.
                </p>
                <Link to="/#contact">
                  <Button size="lg">
                    Prendre rendez-vous
                  </Button>
                </Link>
              </div>
              <div className="relative">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-elegant">
                  <img 
                    src={officeImage} 
                    alt="Consultation avec nos conseillers"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-20 lg:py-32 bg-gradient-subtle relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Nos valeurs fondamentales
              </h2>
              <p className="text-lg text-foreground/70">
                Ces principes guident chaque interaction avec nos clients et structurent notre approche du conseil.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <div
                    key={index}
                    className="p-8 rounded-2xl bg-background/80 backdrop-blur-sm border border-border shadow-soft hover:shadow-medium transition-all duration-300 group"
                  >
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-foreground">
                      {value.title}
                    </h3>
                    <p className="text-foreground/70 leading-relaxed">{value.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                <img src={advisyTextLogo} alt="Advisy" className="h-10 inline-block mx-2" />
                en chiffres
              </h2>
              <p className="text-lg text-muted-foreground">
                Notre mission en quelques statistiques clés
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div 
                    key={index} 
                    className="group relative text-center space-y-4 p-6 rounded-2xl bg-gradient-card backdrop-blur-sm border border-border hover:scale-110 transition-all duration-500 cursor-pointer"
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    {/* Glow effect background */}
                    <div className={`absolute inset-0 rounded-2xl ${stat.glowColor} ${stat.hoverGlow} transition-all duration-500 opacity-0 group-hover:opacity-100`} />
                    
                    {/* Shine animation overlay */}
                    <div className="absolute inset-0 rounded-2xl overflow-hidden">
                      <div 
                        className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        style={{ width: '50%' }}
                      />
                    </div>
                    
                    {/* Content */}
                    <div className="relative z-10">
                      <div className={`w-20 h-20 mx-auto rounded-2xl ${stat.bgColor} flex items-center justify-center ${stat.glowColor} group-hover:scale-110 transition-all duration-500 mb-4`}>
                        <Icon className={`w-10 h-10 ${stat.iconColor} group-hover:scale-110 transition-transform duration-300`} />
                      </div>
                      <div className={`text-5xl font-bold ${stat.color} ${stat.animated ? 'animate-pulse' : ''} group-hover:scale-110 transition-all duration-500 drop-shadow-lg`}>
                        {stat.value}
                      </div>
                      <div className="text-foreground/70 font-medium mt-2">{stat.label}</div>
                    </div>

                    {/* Pulsing ring effect */}
                    <div className={`absolute inset-0 rounded-2xl ${stat.bgColor} animate-ping opacity-0 group-hover:opacity-20`} style={{ animationDuration: '2s' }} />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Expertise Section */}
        <section className="py-20 lg:py-32 bg-gradient-subtle">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <div className="relative order-2 lg:order-1">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-elegant">
                  <img 
                    src={teamImage} 
                    alt="L'équipe Advisy"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="space-y-8 order-1 lg:order-2">
                <div>
                  <div className="inline-block px-4 py-2 bg-primary/10 rounded-full mb-4">
                    <span className="text-primary font-semibold">Notre Expertise</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                    Une approche sur mesure
                  </h2>
                </div>
                
                {expertise.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      {item.title}
                    </h3>
                    <p className="text-foreground/70 leading-relaxed pl-7">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Partners Section */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <div className="inline-block px-4 py-2 bg-primary/10 rounded-full">
                <span className="text-primary font-semibold">Nos Partenaires</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Un réseau de confiance
              </h2>
              <p className="text-lg text-foreground/70 leading-relaxed flex flex-wrap items-center gap-2">
                <img src={advisyTextLogo} alt="Advisy" className="h-5 inline-block" />
                <span>collabore avec les principaux acteurs suisses de l'assurance et de la finance, garantissant des solutions neutres, performantes et sur mesure pour chaque client.</span>
              </p>
              <div className="pt-8">
                <Link to="/#contact">
                  <Button size="lg">
                    Découvrir nos solutions
                  </Button>
                </Link>
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

export default APropos;
