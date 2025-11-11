import { Shield, LineChart, Briefcase, Calculator, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import bgPattern from "@/assets/bg-pattern.png";
import advisorMan from "@/assets/advisor-man.jpg";

const services = [
  {
    title: "Assurance santé (LAMal, LCA, complémentaires)",
    badge: "Santé",
    description:
      "Trouvez la meilleure assurance maladie selon votre profil. Comparaison des modèles et franchises pour optimiser vos coûts et prestations.",
    icon: Shield,
  },
  {
    title: "Prévoyance et 3ᵉ pilier",
    badge: "Prévoyance",
    description:
      "Préparez votre avenir avec le 3ᵉ pilier : sécurité, fiscalité et liberté. Pilier 3a ou 3b selon vos objectifs.",
    icon: LineChart,
  },
  {
    title: "Assurance ménage & RC privée",
    badge: "Protection",
    description:
      "Protégez vos biens et votre responsabilité à petit prix. RC privée et assurance ménage pour éviter les mauvaises surprises.",
    icon: Shield,
  },
  {
    title: "Assurance automobile & 2 roues",
    badge: "Mobilité",
    description:
      "RC, casco partielle, casco complète : trouvez la solution adaptée à votre véhicule et votre budget.",
    icon: Calculator,
  },
  {
    title: "Protection juridique",
    badge: "Défense",
    description:
      "Ne soyez plus seul face aux litiges. Droit du travail, circulation, logement : défendez vos droits sans frais d'avocat.",
    icon: Shield,
  },
];

export const ServicesSection = () => {
  const scrollToContact = () => {
    const element = document.querySelector("#contact");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section 
      id="services" 
      className="relative py-24 lg:py-40 overflow-hidden"
    >
      
      <div className="container relative z-10 mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-20 animate-fade-in max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">
              Notre expertise
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            Solutions sur mesure pour{" "}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              vos besoins
            </span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Une vision claire et des recommandations concrètes pour optimiser
            votre protection et vos finances.
          </p>
        </div>

        {/* Services Grid - Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-4 mx-auto mb-16">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div
                key={index}
                className="relative bg-gradient-card backdrop-blur-sm rounded-2xl p-6 sm:p-5 lg:p-6 xl:p-5 border border-border shadow-medium transition-all duration-300 animate-slide-up overflow-hidden hover:shadow-strong hover:border-primary/30"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Icon */}
                <div className="relative w-14 h-14 sm:w-12 sm:h-12 lg:w-14 lg:h-14 xl:w-12 xl:h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 shadow-medium transition-all duration-300 mx-auto">
                  <Icon className="w-7 h-7 sm:w-6 sm:h-6 lg:w-7 lg:h-7 xl:w-6 xl:h-6 text-white" />
                </div>

                {/* Badge */}
                <Badge
                  variant="secondary"
                  className="relative mb-3 bg-accent text-accent-foreground font-semibold px-3 py-1 text-xs sm:text-[10px] lg:text-xs w-full justify-center"
                >
                  {service.badge}
                </Badge>

                {/* Title */}
                <h3 className="relative text-base sm:text-sm lg:text-base xl:text-sm font-bold text-foreground mb-3 text-center leading-tight">
                  {service.title}
                </h3>

                {/* Description */}
                <p className="relative text-sm sm:text-xs lg:text-sm xl:text-xs text-muted-foreground leading-relaxed text-center">
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Expert CTA Section */}
        <div className="max-w-5xl mx-auto">
          <div className="relative bg-gradient-card backdrop-blur-sm rounded-3xl overflow-hidden border border-border shadow-strong">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Image */}
              <div className="relative h-full min-h-[250px] sm:min-h-[300px] lg:min-h-[400px] order-2 lg:order-1 rounded-t-3xl lg:rounded-t-none lg:rounded-l-3xl overflow-hidden">
                <img
                  src={advisorMan}
                  alt="Expert conseil Advisy"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b lg:bg-gradient-to-r from-transparent via-transparent to-background/60" />
              </div>
              
              {/* Content */}
              <div className="p-6 sm:p-8 lg:p-12 space-y-4 sm:space-y-6 order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-xs sm:text-sm font-semibold text-primary">
                    Conseil personnalisé
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
                  Parlons de votre situation
                </h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                  Chaque situation est unique. Nos experts analysent vos besoins 
                  et vous proposent les solutions les plus adaptées, sans engagement.
                </p>
                <Button
                  size="lg"
                  onClick={scrollToContact}
                  className="w-full sm:w-auto text-base sm:text-lg px-8 sm:px-12 shadow-glow group"
                >
                  <span className="relative z-10">Consultation gratuite</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-light to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
