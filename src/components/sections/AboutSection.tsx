import { Eye, Users, MapPin, Target } from "lucide-react";
import officeConsultation from "@/assets/office-consultation.jpg";
import advisyTextLogo from "@/assets/advisy-text-logo.svg";

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
    <section id="apropos" className="relative py-20 lg:py-32 bg-background overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-40 left-20 w-96 h-96 bg-primary rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="container relative z-10 mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">
              Qui sommes-nous
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 flex items-center justify-center gap-4 flex-wrap">
            <img src={advisyTextLogo} alt="Advisy" className="h-12 md:h-14 object-contain" />
            <span>en</span>{" "}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              quelques mots
            </span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            <img src={advisyTextLogo} alt="Advisy" className="inline-block h-6 mx-1 align-baseline" /> est un cabinet de conseil indépendant basé en Suisse romande.
            Notre mission : vous aider à prendre des décisions éclairées pour vos
            assurances et vos finances, sans jargon ni mauvaises surprises.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-16">
          {/* Image Section */}
          <div className="relative animate-fade-in">
            <div className="relative rounded-3xl overflow-hidden shadow-strong group">
              <img
                src={officeConsultation}
                alt="Consultation personnalisée chez Advisy"
                className="w-full h-[500px] object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8">
                <div className="bg-card/90 backdrop-blur-sm rounded-2xl p-6 border border-border shadow-medium">
                  <p className="text-foreground font-semibold text-lg mb-2">
                    💼 Conseil personnalisé
                  </p>
                  <p className="text-muted-foreground">
                    Des experts à votre écoute pour des solutions sur mesure
                  </p>
                </div>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-primary/20 rounded-full blur-2xl -z-10" />
            <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-accent blur-2xl -z-10" />
          </div>

          {/* Values Grid */}
          <div className="grid gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div
                  key={index}
                  className="group bg-gradient-card backdrop-blur-sm rounded-2xl p-6 border border-border shadow-medium hover:shadow-glow transition-all duration-500 hover:-translate-x-2 animate-slide-up"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-xl bg-gradient-primary flex items-center justify-center shadow-medium group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                      <Icon className="w-7 h-7 text-white" />
                    </div>

                    <div className="flex-1">
                      {/* Title */}
                      <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                        {value.title}
                      </h3>

                      {/* Description */}
                      <p className="text-muted-foreground leading-relaxed">
                        {value.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
