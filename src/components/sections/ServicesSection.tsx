import { Shield, LineChart, Briefcase, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const services = [
  {
    title: "Assurances maladie & LCA",
    badge: "Particuliers",
    description:
      "Analyse de vos couvertures LAMal et complémentaires, comparaison des primes et recommandations adaptées à votre profil et à votre budget.",
    icon: Shield,
  },
  {
    title: "Prévoyance & 3e pilier",
    badge: "Préparer l'avenir",
    description:
      "Mise en place de solutions de prévoyance pour protéger votre famille, optimiser vos impôts et préparer votre retraite.",
    icon: LineChart,
  },
  {
    title: "Solutions pour indépendants",
    badge: "Indépendants & PME",
    description:
      "Accompagnement complet pour vos assurances, votre prévoyance professionnelle et la protection de votre activité.",
    icon: Briefcase,
  },
  {
    title: "Budget & optimisation financière",
    badge: "Accompagnement",
    description:
      "Vision globale de vos charges, optimisation de vos primes et mise en place d'un plan d'action concret.",
    icon: Calculator,
  },
];

export const ServicesSection = () => {
  return (
    <section id="services" className="relative py-24 lg:py-40 bg-background overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl opacity-20">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent blur-3xl" />
      </div>
      
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

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div
                key={index}
                className="relative bg-gradient-card backdrop-blur-sm rounded-3xl p-10 border border-border shadow-medium hover:shadow-glow transition-all duration-500 hover:-translate-y-3 group animate-slide-up overflow-hidden"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Hover gradient effect */}
                <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity duration-500" />
                
                {/* Icon */}
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mb-8 shadow-medium group-hover:scale-110 group-hover:shadow-glow transition-all duration-500">
                  <Icon className="w-8 h-8 text-white" />
                </div>

                {/* Badge */}
                <Badge
                  variant="secondary"
                  className="relative mb-6 bg-accent text-accent-foreground font-semibold px-4 py-1.5"
                >
                  {service.badge}
                </Badge>

                {/* Title */}
                <h3 className="relative text-2xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors duration-300">
                  {service.title}
                </h3>

                {/* Description */}
                <p className="relative text-base text-muted-foreground leading-relaxed mb-6">
                  {service.description}
                </p>
                
                {/* Arrow link */}
                <div className="relative flex items-center gap-2 text-primary font-semibold group/link">
                  <span className="text-sm">Découvrir</span>
                  <span className="group-hover/link:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
