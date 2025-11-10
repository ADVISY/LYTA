import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Eye, Users, MapPin, Target, Heart, Shield, Award, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import officeImage from "@/assets/office-consultation.jpg";
import teamImage from "@/assets/team-meeting.jpg";

const APropos = () => {
  const values = [
    {
      icon: Eye,
      title: "Transparence",
      description: "Nous expliquons chaque détail pour que vous compreniez vos choix. Pas de jargon complexe, uniquement des informations claires.",
    },
    {
      icon: Users,
      title: "Indépendance",
      description: "Aucun lien exclusif avec une compagnie, uniquement votre intérêt. Nous comparons l'ensemble du marché suisse pour vous.",
    },
    {
      icon: MapPin,
      title: "Proximité",
      description: "Présents partout en Suisse romande pour vous accompagner. Rencontres en personne ou à distance selon vos préférences.",
    },
  ];

  const stats = [
    { icon: Award, value: "500+", label: "Clients satisfaits" },
    { icon: TrendingUp, value: "15+", label: "Années d'expérience" },
    { icon: Shield, value: "100%", label: "Taux de satisfaction" },
    { icon: Clock, value: "24h", label: "Délai de réponse" },
  ];

  const expertise = [
    {
      title: "Analyse personnalisée",
      description: "Chaque situation est unique. Nous prenons le temps d'analyser votre profil, vos objectifs et vos besoins pour vous proposer des solutions sur mesure.",
    },
    {
      title: "Accompagnement continu",
      description: "Nous ne disparaissons pas après la signature. Votre conseiller reste à vos côtés pour adapter vos contrats à l'évolution de votre vie.",
    },
    {
      title: "Veille du marché",
      description: "Le monde de l'assurance évolue constamment. Nous surveillons les nouveautés et optimisons régulièrement vos contrats pour garantir le meilleur rapport qualité-prix.",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        {/* Hero Section */}
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-gradient-subtle">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Notre mission & nos valeurs
              </h1>
              <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
                Advisy a pour mission d'apporter de la clarté, de la transparence et de la stratégie dans le monde de l'assurance et de la prévoyance.
                Notre approche repose sur la pédagogie, l'indépendance et la proximité.
              </p>
            </div>
          </div>
        </section>

        {/* Mission Section with Image */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <div className="space-y-6">
                <div className="inline-block px-4 py-2 bg-primary/10 rounded-full">
                  <span className="text-primary font-semibold">Notre Vision</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  Rendre l'assurance simple et accessible
                </h2>
                <p className="text-lg text-foreground/70 leading-relaxed">
                  Trop souvent, l'assurance et la prévoyance sont perçues comme complexes et opaques. 
                  Chez Advisy, nous croyons qu'il est possible de faire autrement.
                </p>
                <p className="text-lg text-foreground/70 leading-relaxed">
                  Notre mission est de démystifier le secteur, d'offrir des conseils personnalisés et indépendants, 
                  et de vous accompagner dans toutes les étapes de votre vie avec des solutions adaptées à vos besoins réels.
                </p>
                <Button size="lg" onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}>
                  Prendre rendez-vous
                </Button>
              </div>
              <div className="relative">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-elegant">
                  <img 
                    src={officeImage} 
                    alt="Consultation avec nos conseillers"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-20 lg:py-32 bg-gradient-subtle relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/src/assets/bg-pattern.png')] opacity-5" />
          
          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Nos valeurs fondamentales
              </h2>
              <p className="text-lg text-foreground/70">
                Ces principes guident chaque interaction avec nos clients et structurent notre approche du conseil.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <div
                    key={index}
                    className="p-8 rounded-2xl bg-background/80 backdrop-blur-sm border border-border shadow-soft hover:shadow-medium transition-all duration-300 group"
                  >
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-foreground">
                      {value.title}
                    </h3>
                    <p className="text-foreground/70 leading-relaxed">{value.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={index} className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-4xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-foreground/70">{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Expertise Section */}
        <section className="py-20 lg:py-32 bg-gradient-subtle">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              <div className="relative order-2 lg:order-1">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-elegant">
                  <img 
                    src={teamImage} 
                    alt="L'équipe Advisy"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="space-y-8 order-1 lg:order-2">
                <div>
                  <div className="inline-block px-4 py-2 bg-primary/10 rounded-full mb-4">
                    <span className="text-primary font-semibold">Notre Expertise</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                    Une approche sur mesure
                  </h2>
                </div>
                
                {expertise.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      {item.title}
                    </h3>
                    <p className="text-foreground/70 leading-relaxed pl-7">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Partners Section */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <div className="inline-block px-4 py-2 bg-primary/10 rounded-full">
                <span className="text-primary font-semibold">Nos Partenaires</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Un réseau de confiance
              </h2>
              <p className="text-lg text-foreground/70 leading-relaxed">
                Advisy collabore avec les principaux acteurs suisses de l'assurance et de la finance, 
                garantissant des solutions neutres, performantes et sur mesure pour chaque client.
              </p>
              <div className="pt-8">
                <Button size="lg" onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}>
                  Découvrir nos solutions
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default APropos;
