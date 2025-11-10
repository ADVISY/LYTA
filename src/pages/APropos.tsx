import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Eye, Users, MapPin } from "lucide-react";

const APropos = () => {
  const values = [
    {
      icon: Eye,
      title: "Transparence",
      description: "Nous expliquons chaque détail pour que vous compreniez vos choix.",
    },
    {
      icon: Users,
      title: "Indépendance",
      description: "Aucun lien exclusif avec une compagnie, uniquement votre intérêt.",
    },
    {
      icon: MapPin,
      title: "Proximité",
      description: "Présents partout en Suisse romande pour vous accompagner.",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        <section id="apropos" className="py-20 lg:py-32 bg-gradient-subtle relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center mb-16">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
                Notre mission & nos valeurs
              </h1>
              <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
                Advisy a pour mission d'apporter de la clarté, de la transparence et de la stratégie dans le monde de l'assurance et de la prévoyance.
                Notre approche repose sur la pédagogie, l'indépendance et la proximité.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mt-16">
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <div
                    key={index}
                    className="p-8 rounded-2xl bg-background/80 backdrop-blur-sm border border-border shadow-soft hover:shadow-medium transition-all duration-300"
                  >
                    <Icon className="w-12 h-12 text-primary mb-4" />
                    <h3 className="text-xl font-semibold mb-3 text-foreground">
                      {value.title}
                    </h3>
                    <p className="text-foreground/70">{value.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Nos partenaires
              </h2>
              <p className="text-lg text-foreground/80 leading-relaxed">
                Advisy collabore avec les principaux acteurs suisses de l'assurance et de la finance, garantissant des solutions neutres, performantes et sur mesure.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default APropos;
