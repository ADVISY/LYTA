import { Award } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import liechtensteinLogo from "@/assets/partners/liechtenstein-life.webp";
import cssLogo from "@/assets/partners/css-logo.png";
import groupeMutuelLogo from "@/assets/partners/groupe-mutuel-logo.png";
import sanitasLogo from "@/assets/partners/sanitas-logo.png";
import paxLogo from "@/assets/partners/pax-logo.png";
import helsanaLogo from "@/assets/partners/helsana-logo.svg";
import swissLifeLogo from "@/assets/partners/swiss-life-logo.jpg";

const partners = [
  { name: "Liechtenstein Life", logo: liechtensteinLogo },
  { name: "CSS", logo: cssLogo },
  { name: "Helsana", logo: helsanaLogo },
  { name: "Groupe Mutuel", logo: groupeMutuelLogo },
  { name: "Sanitas", logo: sanitasLogo },
  { name: "Pax", logo: paxLogo },
  { name: "Swiss Life", logo: swissLifeLogo },
];

export const PartnersSection = () => {
  const [emblaRef] = useEmblaCarousel(
    { 
      loop: true,
      align: "center",
      skipSnaps: false,
      dragFree: false,
    },
    [Autoplay({ delay: 1500, stopOnInteraction: false, stopOnMouseEnter: false })]
  );

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

        {/* Partners Slider */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-6">
            {[...partners, ...partners, ...partners].map((partner, index) => (
              <div
                key={index}
                className="relative bg-card rounded-2xl p-8 border border-border shadow-soft flex items-center justify-center flex-[0_0_180px] min-w-0"
              >
                <div className="w-full h-16 flex items-center justify-center">
                  <img 
                    src={partner.logo} 
                    alt={`Logo ${partner.name}`}
                    className="max-w-full max-h-full object-contain mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert"
                  />
                </div>
              </div>
            ))}
          </div>
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
