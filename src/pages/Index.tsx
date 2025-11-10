import { useState } from "react";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { SplashSection } from "@/components/sections/SplashSection";
import { HeroSlider } from "@/components/sections/HeroSlider";
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

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen">
      {showSplash ? (
        <SplashSection onEnter={handleEnter} />
      ) : (
        <>
          <Navigation />
          <main>
            <section id="accueil" className="relative">
              <HeroSlider
                onContactClick={() => scrollToSection("#contact")}
                onServicesClick={() => scrollToSection("#services")}
              />
            </section>
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
        </>
      )}
    </div>
  );
};

export default Index;
