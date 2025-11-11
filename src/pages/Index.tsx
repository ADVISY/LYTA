import { useState } from "react";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { SplashSection } from "@/components/sections/SplashSection";
import { EnhancedHeroSection } from "@/components/sections/EnhancedHeroSection";
import { ServicesSection } from "@/components/sections/ServicesSection";
import { PartnersSection } from "@/components/sections/PartnersSection";
import { WhyAdvisySection } from "@/components/sections/WhyAdvisySection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { MethodSection } from "@/components/sections/MethodSection";
import { AboutSection } from "@/components/sections/AboutSection";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { ContactSection } from "@/components/sections/ContactSection";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { AIAssistant } from "@/components/AIAssistant";

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);

  const handleEnter = () => {
    setShowSplash(false);
    setTimeout(() => {
      const accueil = document.querySelector("#accueil");
      if (accueil) {
        accueil.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen">
      {!showSplash && <Navigation />}
      {showSplash ? (
        <SplashSection onEnter={handleEnter} />
      ) : (
        <>
          <main>
            <EnhancedHeroSection />
            <ServicesSection />
            <PartnersSection />
            <WhyAdvisySection />
            <HowItWorksSection />
            <MethodSection />
            <AboutSection />
            <TestimonialsSection />
            <FAQSection />
            <ContactSection />
          </main>
          <Footer />
          <WhatsAppButton />
          <AIAssistant />
        </>
      )}
    </div>
  );
};

export default Index;
