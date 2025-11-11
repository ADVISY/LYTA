import { Award } from "lucide-react";
import { useEffect, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { 
      loop: true, 
      dragFree: true,
      containScroll: false,
    },
    [Autoplay({ delay: 1500, stopOnInteraction: false })]
  );

  // Duplicate partners array for seamless infinite scroll
  const duplicatedPartners = [...partners, ...partners, ...partners];

  useEffect(() => {
    if (!emblaApi || !containerRef.current) return;

    const applyTransforms = () => {
      const container = containerRef.current;
      if (!container) return;

      const slides = container.querySelectorAll('.partner-slide');
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;

      slides.forEach((slide) => {
        const slideRect = slide.getBoundingClientRect();
        const slideCenter = slideRect.left + slideRect.width / 2;
        const distanceFromCenter = slideCenter - containerCenter;
        const maxDistance = containerRect.width / 2;
        const normalizedDistance = Math.max(-1, Math.min(1, distanceFromCenter / maxDistance));

        // Apply 3D transforms based on distance from center - INTENSIFIED
        const rotateY = normalizedDistance * -45; // Rotate up to 45deg (was 25deg)
        const translateZ = (1 - Math.abs(normalizedDistance)) * 120; // Move forward when centered (was 50px)
        const scale = 0.75 + (1 - Math.abs(normalizedDistance)) * 0.25; // Scale down at edges
        const opacity = 0.3 + (1 - Math.abs(normalizedDistance)) * 0.7; // More dramatic fade

        (slide as HTMLElement).style.transform = `
          rotateY(${rotateY}deg) 
          translateZ(${translateZ}px)
          scale(${scale})
        `;
        (slide as HTMLElement).style.opacity = `${opacity}`;
      });
    };

    applyTransforms();
    emblaApi.on('scroll', applyTransforms);
    emblaApi.on('reInit', applyTransforms);

    return () => {
      emblaApi.off('scroll', applyTransforms);
      emblaApi.off('reInit', applyTransforms);
    };
  }, [emblaApi]);

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

        {/* Horizontal Carousel with 3D Effect */}
        <div 
          ref={containerRef}
          className="relative overflow-visible py-8" 
          style={{ perspective: "1200px" }}
        >
          <div className="overflow-hidden">
            <div ref={emblaRef} className="overflow-visible">
              <div className="flex gap-8" style={{ transformStyle: "preserve-3d" }}>
                {duplicatedPartners.map((partner, index) => (
                  <div
                    key={`${partner.name}-${index}`}
                    className="partner-slide flex-[0_0_auto] w-40 h-24 transition-all duration-300"
                    style={{
                      transformStyle: "preserve-3d",
                    }}
                  >
                    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-md border border-border p-4 h-full flex items-center justify-center hover:shadow-lg">
                      <img 
                        src={partner.logo} 
                        alt={`Logo ${partner.name}`}
                        className="max-h-12 max-w-full object-contain mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
