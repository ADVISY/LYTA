import advisyLogo from "@/assets/advisy-logo.png";

export const Footer = () => {
  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const navLinks = [
    { label: "Accueil", href: "#accueil" },
    { label: "Services", href: "#services" },
    { label: "Méthode", href: "#methode" },
    { label: "À propos", href: "#apropos" },
    { label: "FAQ", href: "#faq" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <footer className="bg-foreground text-background py-12 lg:py-16">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 items-center">
          {/* Left - Logo */}
          <div>
            <img 
              src={advisyLogo} 
              alt="Advisy - Le bon choix, à chaque fois" 
              className="h-20 w-auto object-contain brightness-0 invert opacity-90"
            />
          </div>

          {/* Center - Navigation */}
          <div className="flex flex-wrap gap-4 justify-center">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollToSection(link.href)}
                className="text-sm text-background/70 hover:text-background transition-colors"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Right - Copyright */}
          <div className="text-right">
            <p className="text-sm text-background/70">
              © Advisy – Conseil en assurances et finances en Suisse romande.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
