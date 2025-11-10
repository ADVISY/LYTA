import { Button } from "@/components/ui/button";
import bgPattern from "@/assets/bg-pattern.png";

interface SplashSectionProps {
  onEnter: () => void;
}

export const SplashSection = ({ onEnter }: SplashSectionProps) => {
  return (
    <section
      id="splash"
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${bgPattern})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/80" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-4 animate-scale-in">
        {/* Logo with icon */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-3xl bg-neutral-light flex items-center justify-center shadow-medium">
            <div className="relative">
              <div className="absolute -left-1 -top-1 w-8 h-8 rounded-full bg-primary" />
              <div className="absolute left-3 top-3 w-6 h-6 rounded-full bg-primary" />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-6xl md:text-7xl font-bold text-primary mb-2">
              advisy<span className="text-primary">.</span>
            </h1>
            <p className="text-sm md:text-base text-primary font-medium tracking-wide uppercase">
              Le bon choix, à chaque fois.
            </p>
          </div>
        </div>

        {/* Enter Button */}
        <Button
          size="lg"
          onClick={onEnter}
          className="bg-gradient-to-r from-primary to-primary-light text-lg tracking-widest uppercase"
        >
          e n t e r
        </Button>

        {/* Website URL */}
        <p className="text-sm text-primary font-medium mt-8 tracking-wide">
          w w w . e – a d v i s y . c h
        </p>
      </div>
    </section>
  );
};
