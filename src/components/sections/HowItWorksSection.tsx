import { Search, GitCompare, HeartHandshake, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import teamMeeting from "@/assets/team-meeting.jpg";

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
    <section className="relative py-20 lg:py-32 bg-gradient-subtle overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-96 h-96 bg-primary rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent rounded-full blur-3xl" />
      </div>
      
      <div className="container relative z-10 mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">
              Notre processus
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Comment ça{" "}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              fonctionne ?
            </span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Un processus simple et transparent pour vous accompagner vers les meilleures solutions.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-6xl mx-auto mb-16">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="group relative text-center space-y-6 animate-slide-up"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {/* Connecting line - desktop only */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary via-primary-light to-transparent animate-pulse" />
                )}
                
                {/* Icon Container */}
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow group-hover:scale-110 group-hover:shadow-strong transition-all duration-500">
                    <Icon className="w-16 h-16 text-white" />
                  </div>
                  <div className="absolute -bottom-3 -right-3 w-14 h-14 rounded-full bg-foreground text-white flex items-center justify-center text-2xl font-bold shadow-medium group-hover:scale-110 transition-transform duration-300">
                    {step.number}
                  </div>
                  {/* Decorative glow */}
                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl -z-10 group-hover:bg-primary/30 transition-colors duration-500" />
                </div>
                
                <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                  {step.title}
                </h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA Section with Image */}
        <div className="relative max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 items-center bg-gradient-card backdrop-blur-sm rounded-3xl overflow-hidden shadow-strong border border-border">
            {/* Image */}
            <div className="relative h-full min-h-[300px] lg:min-h-[400px]">
              <img
                src={teamMeeting}
                alt="Équipe Advisy en consultation"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background/60 to-transparent lg:hidden" />
            </div>
            
            {/* CTA Content */}
            <div className="p-8 lg:p-12 space-y-6">
              <h3 className="text-3xl md:text-4xl font-bold text-foreground">
                Prêt à optimiser vos assurances ?
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Bénéficiez d'une analyse gratuite et sans engagement de votre situation. 
                Nos experts vous accompagnent pour trouver les meilleures solutions.
              </p>
              <Button
                size="lg"
                onClick={scrollToContact}
                className="text-lg px-12 shadow-glow group"
              >
                <span className="relative z-10">📞 Analyse gratuite</span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary-light to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
