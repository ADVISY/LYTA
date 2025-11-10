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
    <section id="services" className="py-20 lg:py-32 bg-background">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Nos services
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Une vision claire de vos assurances et de vos finances.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div
                key={index}
                className="bg-card rounded-2xl p-8 border border-border shadow-soft hover:shadow-strong transition-all duration-300 hover:-translate-y-2 group animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Icon */}
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                  <Icon className="w-7 h-7 text-primary group-hover:text-white transition-colors duration-300" />
                </div>

                {/* Badge */}
                <Badge
                  variant="secondary"
                  className="mb-4 bg-accent text-accent-foreground"
                >
                  {service.badge}
                </Badge>

                {/* Title */}
                <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                  {service.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
