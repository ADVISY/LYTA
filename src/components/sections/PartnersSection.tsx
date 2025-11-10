import { Award } from "lucide-react";

const partners = [
  { name: "Swica", logo: "https://www.swica.ch/dam/jcr:2d8e0e9c-8e8a-4e8a-8e8a-8e8a8e8a8e8a/swica-logo.svg" },
  { name: "CSS", logo: "https://www.css.ch/dam/jcr:2d8e0e9c-8e8a-4e8a-8e8a-8e8a8e8a8e8a/css-logo.svg" },
  { name: "Helsana", logo: "https://www.helsana.ch/dam/jcr:2d8e0e9c-8e8a-4e8a-8e8a-8e8a8e8a8e8a/helsana-logo.svg" },
  { name: "Groupe Mutuel", logo: "https://www.groupemutuel.ch/dam/jcr:2d8e0e9c-8e8a-4e8a-8e8a-8e8a8e8a8e8a/gm-logo.svg" },
  { name: "Assura", logo: "https://www.assura.ch/dam/jcr:2d8e0e9c-8e8a-4e8a-8e8a-8e8a8e8a8e8a/assura-logo.svg" },
  { name: "Visana", logo: "https://www.visana.ch/dam/jcr:2d8e0e9c-8e8a-4e8a-8e8a-8e8a8e8a8e8a/visana-logo.svg" },
];

export const PartnersSection = () => {
  return (
    <section className="relative py-16 bg-background overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-transparent" />
      
      <div className="container relative z-10 mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Award className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">
              Nos partenaires
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Accès aux{" "}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              meilleures compagnies
            </span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Nous comparons les offres de toutes les grandes compagnies d'assurance suisses
            pour vous proposer la solution la plus avantageuse.
          </p>
        </div>

        {/* Partners Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center">
          {partners.map((partner, index) => (
            <div
              key={index}
              className="group relative bg-card rounded-2xl p-6 border border-border hover:border-primary/50 shadow-soft hover:shadow-glow transition-all duration-500 hover:-translate-y-2 animate-fade-in flex items-center justify-center"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Placeholder pour les logos - à remplacer par de vrais logos */}
              <div className="w-full h-16 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1 group-hover:scale-110 transition-transform">
                    {partner.name.charAt(0)}
                  </div>
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {partner.name}
                  </p>
                </div>
              </div>
              
              {/* Hover effect */}
              <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-500" />
            </div>
          ))}
        </div>

        {/* Bottom text */}
        <div className="text-center mt-8 animate-fade-in">
          <p className="text-sm text-muted-foreground">
            Et plus de <span className="font-bold text-primary">50+ compagnies</span> d'assurance en Suisse
          </p>
        </div>
      </div>
    </section>
  );
};
