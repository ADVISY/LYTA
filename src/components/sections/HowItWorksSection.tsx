import { Search, GitCompare, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: Search,
    number: "1",
    title: "Analyse gratuite de votre situation",
    description: "Nous analysons vos besoins et votre situation actuelle sans engagement.",
  },
  {
    icon: GitCompare,
    number: "2",
    title: "Comparaison personnalisée",
    description: "Nous comparons les meilleures offres du marché adaptées à votre profil.",
  },
  {
    icon: HeartHandshake,
    number: "3",
    title: "Accompagnement et suivi",
    description: "Nous vous accompagnons dans la mise en place et restons à vos côtés.",
  },
];

export const HowItWorksSection = () => {
  const scrollToContact = () => {
    const element = document.querySelector("#contact");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="py-20 lg:py-32 bg-gradient-subtle relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
      
      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Comment ça fonctionne ?
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Un processus simple et transparent pour vous accompagner vers les meilleures solutions.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto mb-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="relative text-center space-y-6"
              >
                {/* Connecting line - desktop only */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                )}
                
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
                    <Icon className="w-16 h-16 text-white" />
                  </div>
                  <div className="absolute -bottom-3 -right-3 w-12 h-12 rounded-full bg-foreground text-white flex items-center justify-center text-2xl font-bold shadow-medium">
                    {step.number}
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="text-lg text-muted-foreground">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Button
            size="lg"
            onClick={scrollToContact}
            className="text-lg px-12"
          >
            📞 Obtenez votre analyse gratuite dès aujourd'hui
          </Button>
        </div>
      </div>
    </section>
  );
};
