import { Button } from "@/components/ui/button";
import bgPattern from "@/assets/bg-pattern.png";
import advisyLogo from "@/assets/advisy-logo.svg";

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
        {/* Logo and branding */}
        <div className="flex flex-col items-center gap-6">
          <img 
            src={advisyLogo} 
            alt="Advisy - Le bon choix, à chaque fois" 
            className="w-auto h-32 md:h-40 object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-300"
          />
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
