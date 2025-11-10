import { useState } from "react";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { SplashSection } from "@/components/sections/SplashSection";
import { EnhancedHeroSection } from "@/components/sections/EnhancedHeroSection";
import { ServicesSection } from "@/components/sections/ServicesSection";
import { MethodSection } from "@/components/sections/MethodSection";
import { AboutSection } from "@/components/sections/AboutSection";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { ContactSection } from "@/components/sections/ContactSection";

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);

  const handleEnter = () => {
    setShowSplash(false);
    // Scroll to main content after a brief delay
    setTimeout(() => {
      const accueil = document.querySelector("#accueil");
      if (accueil) {
        accueil.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen">
      {showSplash ? (
        <SplashSection onEnter={handleEnter} />
      ) : (
        <>
          <Navigation />
          <main>
            <EnhancedHeroSection />
            <ServicesSection />
            <MethodSection />
            <AboutSection />
            <TestimonialsSection />
            <FAQSection />
            <ContactSection />
          </main>
          <Footer />
        </>
      )}
    </div>
  );
};

export default Index;
