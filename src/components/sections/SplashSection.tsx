import { Button } from "@/components/ui/button";
import bgPatternGray from "@/assets/bg-pattern-gray.png";
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
        backgroundImage: `url(${bgPatternGray})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/10" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-4 animate-scale-in">
        {/* Logo and branding */}
        <div className="flex flex-col items-center gap-6">
          <img 
            src={advisyLogo} 
            alt="Advisy - Le bon choix, à chaque fois" 
            className="w-auto h-40 md:h-48 lg:h-56 object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Enter Button */}
        <Button
          size="lg"
          onClick={onEnter}
          className="relative group bg-gradient-primary text-white text-lg tracking-[0.4em] uppercase font-semibold px-16 py-7 rounded-full shadow-glow hover:shadow-[0_0_60px_rgba(24,0,173,0.5)] transition-all duration-500 hover:scale-110 overflow-hidden border-2 border-primary-light/30"
        >
          {/* Effet de brillance animé */}
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          
          {/* Texte avec effet */}
          <span className="relative z-10 flex items-center gap-3">
            e n t e r
            <span className="group-hover:translate-x-2 transition-transform duration-300">→</span>
          </span>
        </Button>

        {/* Website URL */}
        <p className="text-sm text-primary font-medium mt-8 tracking-wide">
          w w w . e – a d v i s y . c h
        </p>
      </div>
    </section>
  );
};
