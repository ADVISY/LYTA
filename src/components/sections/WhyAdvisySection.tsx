import { CheckCircle, Users, Lightbulb, BarChart3, MapPin } from "lucide-react";

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
    <section className="py-20 lg:py-32 bg-background">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Pourquoi choisir Advisy ?
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Chez Advisy, nous rendons les assurances et la prévoyance simples et compréhensibles.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
          {advantages.map((advantage, index) => {
            const Icon = advantage.icon;
            return (
              <div
                key={index}
                className="text-center space-y-4 p-6 rounded-2xl bg-gradient-subtle hover:shadow-medium transition-all duration-300"
              >
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center shadow-medium">
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  {advantage.title}
                </h3>
                <p className="text-muted-foreground">
                  {advantage.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
