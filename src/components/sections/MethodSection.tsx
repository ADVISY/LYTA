import { Search, ClipboardCheck, Rocket } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Découverte",
    description:
      "Nous faisons le point sur votre situation actuelle, vos besoins et vos objectifs (en ligne ou en présentiel).",
    icon: Search,
  },
  {
    number: "02",
    title: "Analyse & recommandations",
    description:
      "Nous comparons les solutions du marché et vous présentons des options claires, avec leurs avantages et inconvénients.",
    icon: ClipboardCheck,
  },
  {
    number: "03",
    title: "Mise en place & suivi",
    description:
      "Nous vous accompagnons dans les démarches et restons disponibles pour les ajustements au fil du temps.",
    icon: Rocket,
  },
];

export const MethodSection = () => {
  return (
    <section id="methode" className="py-20 lg:py-32 bg-gradient-subtle">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Comment ça se passe ?
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
          {/* Connection Line - Desktop */}
          <div className="hidden md:block absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary-light to-primary -z-10" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="relative animate-slide-up"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {/* Step Card */}
                <div className="bg-card rounded-2xl p-8 shadow-medium hover:shadow-strong transition-all duration-300 border border-border">
                  {/* Number Badge */}
                  <div className="absolute -top-6 left-8 w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold shadow-medium">
                    {step.number}
                  </div>

                  {/* Icon */}
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6 mt-6">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
