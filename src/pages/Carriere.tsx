import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Rocket, GraduationCap, TrendingUp, Users, Target, Award, Briefcase, Heart, CheckCircle2 } from "lucide-react";
import trainingImage from "@/assets/team-expertise.jpg";
import consultationImage from "@/assets/family-consultation.jpg";
import teamMeeting from "@/assets/team-meeting.jpg";
import advisyTextLogo from "@/assets/advisy-text-logo.svg";
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const Carriere = () => {
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
      image: trainingImage,
      title: "Formation continue",
      description: "Devenez expert avec notre académie interne",
    },
    {
      image: consultationImage,
      title: "Coaching personnalisé",
      description: "Accompagnement par des mentors expérimentés",
    },
    {
      image: teamMeeting,
      title: "Équipe dynamique",
      description: "Rejoignez une équipe passionnée et ambitieuse",
    },
  ];

  const benefits = [
    {
      icon: GraduationCap,
      title: "Formation complète",
      description: "Programme de formation interne certifié pour devenir un expert en assurance et prévoyance. Formations continues et certifications reconnues.",
    },
    {
      icon: Users,
      title: "Coaching personnalisé",
      description: "Accompagnement individuel par des mentors expérimentés. Feedback régulier et plan de développement sur mesure.",
    },
    {
      icon: TrendingUp,
      title: "Rémunération attractive",
      description: "Système de commissions motivant avec bonus de performance. Évolution rapide et primes d'excellence.",
    },
    {
      icon: Briefcase,
      title: "Flexibilité",
      description: "Gestion autonome de ton emploi du temps. Équilibre vie professionnelle-personnelle respecté.",
    },
    {
      icon: Target,
      title: "Outils digitaux",
      description: "Plateforme moderne de gestion clients. CRM, simulateurs, et outils de prospection performants.",
    },
    {
      icon: Heart,
      title: "Esprit d'équipe",
      description: "Ambiance collaborative et bienveillante. Événements team building et culture d'entreprise forte.",
    },
  ];

  const process = [
    {
      step: "01",
      title: "Candidature",
      description: "Envoie-nous ton CV et ta motivation via le formulaire ci-dessous.",
    },
    {
      step: "02",
      title: "Entretien découverte",
      description: "Rencontre avec notre équipe pour discuter de ton profil et de tes ambitions.",
    },
    {
      step: "03",
      title: "Formation initiale",
      description: "Programme d'intégration de 4 semaines pour maîtriser nos produits et processus.",
    },
    {
      step: "04",
      title: "Lancement",
      description: "Début de ton activité avec accompagnement terrain et suivi personnalisé.",
    },
  ];

  const profiles = [
    "Tu es motivé(e) et ambitieux(se)",
    "Tu aimes le contact humain et le conseil",
    "Tu cherches une évolution rapide de carrière",
    "Tu veux développer tes compétences commerciales",
    "Tu es à l'aise avec les outils digitaux",
    "Tu as l'esprit d'entreprendre",
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
                    <Rocket className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                      Carrière
                    </span>
                  </div>
                  
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight flex flex-wrap items-center gap-3">
                    <span>Rejoins l'aventure</span>
                    <img src={advisyTextLogo} alt="Advisy" className="h-12 md:h-16 object-contain inline-block" />
                  </h1>
                  
                  <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-light">
                    Nous formons la nouvelle génération de conseillers financiers.
                    Formations internes, coaching, outils digitaux et commissions attractives : nous te donnons les moyens de réussir.
                  </p>
                </div>

                <Link to="/#contact">
                  <Button size="lg" className="mt-8">
                    Postule dès maintenant
                  </Button>
                </Link>
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

        {/* Benefits Section */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <div className="inline-block px-4 py-2 bg-primary/10 rounded-full mb-4">
                <span className="text-primary font-semibold">Avantages</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 flex flex-wrap items-center justify-center gap-3">
                <span>Ce qu'</span>
                <img src={advisyTextLogo} alt="Advisy" className="h-10 md:h-12 object-contain inline-block" />
                <span>t'offre</span>
              </h2>
              <p className="text-lg text-foreground/70">
                Rejoindre Advisy, c'est intégrer une équipe dynamique qui investit dans ton succès.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div
                    key={index}
                    className="p-8 rounded-2xl bg-background border border-border shadow-soft hover:shadow-medium transition-all duration-300 group"
                  >
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-foreground">
                      {benefit.title}
                    </h3>
                    <p className="text-foreground/70 leading-relaxed">{benefit.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Formation Section with Image */}
        <section className="py-20 lg:py-32 bg-gradient-subtle">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <div className="space-y-6">
                <div className="inline-block px-4 py-2 bg-primary/10 rounded-full">
                  <span className="text-primary font-semibold">Formation</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  Deviens expert avec notre académie interne
                </h2>
                <p className="text-lg text-foreground/70 leading-relaxed">
                  Même sans expérience préalable dans l'assurance, notre programme de formation te permet d'acquérir toutes les compétences nécessaires pour exceller dans le métier.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Award className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <div className="font-semibold text-foreground">Certifications reconnues</div>
                      <div className="text-foreground/70">Formations certifiantes en assurance et prévoyance</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <GraduationCap className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <div className="font-semibold text-foreground">Modules pratiques</div>
                      <div className="text-foreground/70">Simulations, jeux de rôle et cas concrets</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Users className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <div className="font-semibold text-foreground">Accompagnement terrain</div>
                      <div className="text-foreground/70">Mentoring et suivis personnalisés</div>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="relative">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-elegant">
                  <img 
                    src={trainingImage} 
                    alt="Formation interne Advisy"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <div className="inline-block px-4 py-2 bg-primary/10 rounded-full mb-4">
                <span className="text-primary font-semibold">Processus</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 flex flex-wrap items-center justify-center gap-3">
                <span>Comment rejoindre</span>
                <img src={advisyTextLogo} alt="Advisy" className="h-10 md:h-12 object-contain inline-block" />
                <span>?</span>
              </h2>
              <p className="text-lg text-foreground/70">
                Un processus simple et transparent en 4 étapes.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {process.map((item, index) => (
                <div key={index} className="relative">
                  <div className="space-y-4">
                    <div className="text-5xl font-bold text-primary/20">{item.step}</div>
                    <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                    <p className="text-foreground/70 leading-relaxed">{item.description}</p>
                  </div>
                  {index < process.length - 1 && (
                    <div className="hidden lg:block absolute top-8 -right-4 w-8 h-0.5 bg-primary/20" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Profile Section */}
        <section className="py-20 lg:py-32 bg-gradient-subtle">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <div className="relative order-2 lg:order-1">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-elegant">
                  <img 
                    src={consultationImage} 
                    alt="Conseiller Advisy avec client"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="space-y-6 order-1 lg:order-2">
                <div className="inline-block px-4 py-2 bg-primary/10 rounded-full">
                  <span className="text-primary font-semibold">Profil recherché</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground flex flex-wrap items-center gap-3">
                  <span>Es-tu fait(e) pour</span>
                  <img src={advisyTextLogo} alt="Advisy" className="h-10 md:h-12 object-contain inline-block" />
                  <span>?</span>
                </h2>
                <p className="text-lg text-foreground/70 leading-relaxed">
                  Nous recherchons des personnes passionnées, motivées et désireuses d'apprendre. 
                  Aucune expérience en assurance n'est requise – nous formons nos talents !
                </p>
                <ul className="space-y-3">
                  {profiles.map((profile, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground">{profile}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/#contact">
                  <Button size="lg" className="mt-4">
                    Postuler maintenant
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto text-center space-y-8 p-12 rounded-3xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
              <Rocket className="w-16 h-16 mx-auto text-primary" />
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Prêt(e) à lancer ta carrière ?
              </h2>
                <p className="text-lg text-foreground/70 max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-2">
                  <span>Rejoins une équipe qui croit en ton potentiel et qui investit dans ta réussite. 
                  Démarre ton aventure chez</span>
                  <img src={advisyTextLogo} alt="Advisy" className="h-6 object-contain inline-block" />
                  <span>dès aujourd'hui.</span>
                </p>
              <Link to="/#contact">
                <Button size="lg">
                  Envoyer ma candidature
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Carriere;
