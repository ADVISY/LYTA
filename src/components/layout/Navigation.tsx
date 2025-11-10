import { useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import advisyLogo from "@/assets/advisy-logo.svg";

const navLinks = [
  { label: "Accueil", href: "/", type: "link" },
  { 
    label: "Assurances", 
    type: "dropdown",
    subLinks: [
      { label: "Particuliers", subItems: [
        { label: "Assurance santé", href: "/assurances/sante" },
        { label: "Assurance vie & 3ᵉ pilier", href: "/assurances/3e-pilier" },
        { label: "Assurance RC & ménage", href: "/assurances/rc-menage" },
        { label: "Assurance automobile", href: "/assurances/auto" },
        { label: "Protection juridique", href: "/assurances/protection-juridique" },
        { label: "Hypothèque & financement", href: "/assurances/hypotheque" },
      ]},
      { label: "Entreprises", subItems: [
        { label: "Assurance du personnel", href: "/entreprises/personnel" },
        { label: "Prévoyance LPP", href: "/entreprises/lpp" },
      ]},
    ]
  },
  { 
    label: "À propos", 
    type: "dropdown",
    subLinks: [
      { label: "Notre mission", href: "/a-propos" },
      { label: "Carrière", href: "/carriere" },
    ]
  },
  { label: "Contact", href: "#contact", type: "scroll" },
  { label: "Connexion", href: "/connexion", type: "link" },
];

export const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsOpen(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-glass border-b border-border/50 shadow-xs">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-24">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center hover:scale-105 transition-all duration-300"
          >
            <img 
              src={advisyLogo} 
              alt="Advisy - Le bon choix, à chaque fois" 
              className="h-14 md:h-16 w-auto object-contain"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-10">
            {navLinks.map((link) => (
              <div
                key={link.label}
                className="relative group"
                onMouseEnter={() => link.type === "dropdown" && setActiveDropdown(link.label)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                {link.type === "link" && link.href && (
                  <Link
                    to={link.href}
                    className="text-sm font-semibold text-muted-foreground hover:text-primary transition-all duration-300 relative group flex items-center gap-1"
                  >
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-primary group-hover:w-full transition-all duration-300" />
                  </Link>
                )}
                
                {link.type === "scroll" && link.href && (
                  <button
                    onClick={() => scrollToSection(link.href!)}
                    className="text-sm font-semibold text-muted-foreground hover:text-primary transition-all duration-300 relative group"
                  >
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-primary group-hover:w-full transition-all duration-300" />
                  </button>
                )}

                {link.type === "dropdown" && (
                  <>
                    <button className="text-sm font-semibold text-muted-foreground hover:text-primary transition-all duration-300 relative flex items-center gap-1">
                      {link.label}
                      <ChevronDown className="w-4 h-4" />
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-primary group-hover:w-full transition-all duration-300" />
                    </button>
                    
                    {activeDropdown === link.label && link.subLinks && (
                      <div className="absolute top-full left-0 mt-2 bg-background border border-border rounded-xl shadow-medium p-4 min-w-[280px] animate-fade-in">
                        {link.subLinks.map((subLink) => (
                          <div key={subLink.label} className="mb-4 last:mb-0">
                            <p className="text-xs font-semibold text-primary uppercase mb-2">{subLink.label}</p>
                            <div className="space-y-1">
                              {subLink.subItems?.map((item) => (
                                <Link
                                  key={item.href}
                                  to={item.href}
                                  className="block px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
                                >
                                  {item.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="lg:hidden absolute top-20 left-0 right-0 bg-background border-b border-border shadow-medium animate-fade-in max-h-[80vh] overflow-y-auto">
          <div className="container mx-auto px-4 py-6 flex flex-col gap-4">
            {navLinks.map((link) => (
              <div key={link.label}>
                {link.type === "link" && link.href && (
                  <Link
                    to={link.href}
                    onClick={() => setIsOpen(false)}
                    className="text-left text-base font-medium text-foreground hover:text-primary transition-colors py-2 block"
                  >
                    {link.label}
                  </Link>
                )}
                
                {link.type === "scroll" && link.href && (
                  <button
                    onClick={() => {
                      scrollToSection(link.href!);
                      setIsOpen(false);
                    }}
                    className="text-left text-base font-medium text-foreground hover:text-primary transition-colors py-2 w-full"
                  >
                    {link.label}
                  </button>
                )}

                {link.type === "dropdown" && link.subLinks && (
                  <div>
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === link.label ? null : link.label)}
                      className="text-left text-base font-medium text-foreground hover:text-primary transition-colors py-2 w-full flex items-center justify-between"
                    >
                      {link.label}
                      <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === link.label ? 'rotate-180' : ''}`} />
                    </button>
                    {activeDropdown === link.label && (
                      <div className="pl-4 mt-2 space-y-3">
                        {link.subLinks.map((subLink) => (
                          <div key={subLink.label}>
                            <p className="text-xs font-semibold text-primary uppercase mb-2">{subLink.label}</p>
                            <div className="space-y-1">
                              {subLink.subItems?.map((item) => (
                                <Link
                                  key={item.href}
                                  to={item.href}
                                  onClick={() => setIsOpen(false)}
                                  className="block px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
                                >
                                  {item.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};
