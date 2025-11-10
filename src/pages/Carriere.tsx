import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Rocket, GraduationCap, TrendingUp, Users } from "lucide-react";

const Carriere = () => {
  const benefits = [
    {
      icon: GraduationCap,
      title: "Formations internes",
      description: "Programmes complets pour devenir un expert en assurance et prévoyance.",
    },
    {
      icon: Users,
      title: "Coaching personnalisé",
      description: "Accompagnement individuel pour développer tes compétences.",
    },
    {
      icon: TrendingUp,
      title: "Commissions attractives",
      description: "Rémunération motivante et évolution rapide.",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-gradient-subtle">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <Rocket className="w-16 h-16 mx-auto text-primary" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Rejoins l'aventure Advisy.
              </h1>
              <p className="text-lg md:text-xl text-foreground/80 max-w-3xl mx-auto leading-relaxed">
                Nous formons la nouvelle génération de conseillers financiers.
                Formations internes, coaching, outils digitaux et commissions attractives : Advisy te donne les moyens de réussir.
              </p>
              <Button size="lg" className="mt-8" onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}>
                🚀 Postule dès maintenant et découvre ton potentiel
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Ce qu'Advisy t'offre
            </h2>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div
                    key={index}
                    className="p-8 rounded-2xl bg-background border border-border shadow-soft hover:shadow-medium transition-all duration-300"
                  >
                    <Icon className="w-12 h-12 text-primary mb-4" />
                    <h3 className="text-xl font-semibold mb-3 text-foreground">
                      {benefit.title}
                    </h3>
                    <p className="text-foreground/70">{benefit.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Carriere;
