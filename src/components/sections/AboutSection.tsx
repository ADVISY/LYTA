import { Eye, Users, MapPin } from "lucide-react";

const values = [
  {
    title: "Transparence",
    description:
      "Des explications simples, des recommandations argumentées.",
    icon: Eye,
  },
  {
    title: "Indépendance",
    description: "Nous mettons vos intérêts au centre de chaque décision.",
    icon: Users,
  },
  {
    title: "Proximité",
    description:
      "Disponible, réactif, et aligné sur la réalité du terrain en Suisse.",
    icon: MapPin,
  },
];

export const AboutSection = () => {
  return (
    <section id="apropos" className="py-20 lg:py-32 bg-background">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Advisy en quelques mots
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Advisy est un cabinet de conseil indépendant basé en Suisse romande.
            Notre mission : vous aider à prendre des décisions éclairées pour vos
            assurances et vos finances, sans jargon ni mauvaises surprises.
          </p>
        </div>

        {/* Values Grid */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 mt-16">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <div
                key={index}
                className="text-center animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Icon */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-6 shadow-medium hover:scale-110 transition-transform duration-300">
                  <Icon className="w-10 h-10 text-white" />
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-foreground mb-3">
                  {value.title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground leading-relaxed">
                  {value.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
