import { CheckCircle, Users, Lightbulb, BarChart3, MapPin, Award } from "lucide-react";
import advisyTextLogo from "@/assets/advisy-text-logo.svg";

const advantages = [
  {
    icon: Users,
    title: "Conseil indépendant",
    description: "Aucun lien exclusif avec une compagnie.",
  },
  {
    icon: CheckCircle,
    title: "Accompagnement complet",
    description: "De l'analyse à la mise en place, on s'occupe de tout.",
  },
  {
    icon: Lightbulb,
    title: "Pédagogie avant tout",
    description: "Nous expliquons, vous décidez.",
  },
  {
    icon: BarChart3,
    title: "Optimisation sur mesure",
    description: "Comparaison personnalisée selon votre profil.",
  },
  {
    icon: MapPin,
    title: "Présence nationale",
    description: "Conseillers dans toute la Suisse romande.",
  },
];

export const WhyAdvisySection = () => {
  return (
    <section className="relative py-20 lg:py-32 bg-background overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-40 right-20 w-96 h-96 bg-primary rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-accent rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Award className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">
              Nos avantages
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 flex items-center justify-center gap-3 flex-wrap">
            <span>Pourquoi choisir</span>{" "}
            <img src={advisyTextLogo} alt="Advisy" className="h-12 md:h-14 object-contain" />
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              ?
            </span>
          </h2>
          <p className="text-xl text-muted-foreground flex items-center justify-center gap-2 flex-wrap">
            <span>Chez</span>
            <img src={advisyTextLogo} alt="Advisy" className="inline-block h-6 align-baseline" />
            <span>, nous rendons les assurances et la prévoyance simples et compréhensibles.</span>
          </p>
        </div>

        {/* Advantages Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-8">
          {advantages.map((advantage, index) => {
            const Icon = advantage.icon;
            return (
              <div
                key={index}
                className="group text-center space-y-4 p-8 rounded-3xl bg-gradient-card backdrop-blur-sm border border-border hover:shadow-glow transition-all duration-500 hover:-translate-y-3 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Icon with animation */}
                <div className="relative mx-auto w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-medium group-hover:scale-110 group-hover:shadow-glow transition-all duration-500">
                  <Icon className="w-10 h-10 text-white" />
                  {/* Decorative glow */}
                  <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl -z-10 group-hover:bg-primary/40 transition-colors duration-500" />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                  {advantage.title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground leading-relaxed">
                  {advantage.description}
                </p>

                {/* Hover indicator */}
                <div className="h-1 w-0 mx-auto bg-gradient-primary rounded-full group-hover:w-12 transition-all duration-300" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
