import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import advisyLogo from "@/assets/advisy-logo.svg";

const PHONE_NUMBER = "+41782122360";
const PHONE_DISPLAY = "+41 78 212 23 60";

const navLinks = [
  { label: "Accueil", href: "/", type: "link" },
  { label: "Simulateurs", href: "/simulateurs", type: "link" },
  { 
    label: "Assurances", 
    type: "dropdown",
    subLinks: [
      { label: "Vue d'ensemble", subItems: [
        { label: "Toutes nos assurances", href: "/assurances" },
      ]},
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
      { label: "À propos", subItems: [
        { label: "Notre mission", href: "/a-propos" },
        { label: "Carrière", href: "/carriere" },
      ]},
    ]
  },
  { label: "Contact", href: "#contact", type: "scroll" },
  { label: "Connexion", href: "/connexion", type: "link" },
];

export const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [closeTimeout, setCloseTimeout] = useState<NodeJS.Timeout | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsOpen(false);
    }
  };

  const handleMouseEnter = (label: string) => {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      setCloseTimeout(null);
    }
    setActiveDropdown(label);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setActiveDropdown(null);
    }, 600);
    setCloseTimeout(timeout);
  };

  return (
    <nav className={`fixed left-1/2 -translate-x-1/2 z-[100] rounded-full transition-all duration-300 overflow-hidden ${
      scrolled 
        ? 'top-4 bg-white/90 shadow-xl backdrop-blur-md w-[95%] max-w-6xl border border-white/40' 
        : 'top-6 bg-white/70 shadow-lg backdrop-blur-md w-[96%] max-w-7xl border border-white/40'
    }`}>
      {/* Glossy shine effect */}
      <div 
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-60 animate-shine"
      />
      
      <div className="relative px-6 lg:px-8">
        <div className={`flex items-center justify-between transition-all duration-300 ${
          scrolled ? 'py-2' : 'py-3'
        }`}>
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center hover:scale-105 transition-all duration-300"
          >
            <img 
              src={advisyLogo} 
              alt="Advisy - Le bon choix, à chaque fois" 
              className={`w-auto object-contain transition-all duration-300 ${
                scrolled ? 'h-12 md:h-14' : 'h-14 md:h-16'
              }`}
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8 flex-1 justify-center">
            {navLinks.map((link) => (
              <div
                key={link.label}
                className="relative group"
                onMouseEnter={() => link.type === "dropdown" && handleMouseEnter(link.label)}
                onMouseLeave={handleMouseLeave}
              >
                {link.type === "link" && link.href && (
                  <Link
                    to={link.href}
                    className="text-sm sm:text-base font-medium text-slate-800 tracking-wide transition-all duration-200 hover:text-[#1800AD] hover:bg-[#1800AD]/10 rounded-full px-3 py-1"
                  >
                    {link.label}
                  </Link>
                )}
                
                {link.type === "scroll" && link.href && (
                  <button
                    onClick={() => scrollToSection(link.href!)}
                    className="text-sm sm:text-base font-medium text-slate-800 tracking-wide transition-all duration-200 hover:text-[#1800AD] hover:bg-[#1800AD]/10 rounded-full px-3 py-1"
                  >
                    {link.label}
                  </button>
                )}

                {link.type === "dropdown" && (
                  <>
                    <button 
                      className="text-sm sm:text-base font-medium text-slate-800 tracking-wide transition-all duration-200 hover:text-[#1800AD] hover:bg-[#1800AD]/10 rounded-full px-3 py-1 flex items-center gap-1"
                      onClick={() => {
                        if (closeTimeout) { clearTimeout(closeTimeout); setCloseTimeout(null); }
                        setActiveDropdown(activeDropdown === link.label ? null : link.label);
                      }}
                      aria-expanded={activeDropdown === link.label}
                      aria-haspopup="menu"
                    >
                      {link.label}
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${activeDropdown === link.label ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {activeDropdown === link.label && link.subLinks && (
                      <div className="absolute top-full left-0 mt-3 z-[120] pointer-events-auto animate-fade-in"
                        onMouseEnter={() => handleMouseEnter(link.label)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-xl shadow-lg min-w-[280px] py-2">
                        {link.subLinks.map((subLink) => (
                          <div key={subLink.label} className="px-4 py-2">
                            <p className="text-xs font-semibold text-[#1800AD] uppercase mb-2">{subLink.label}</p>
                            <div className="space-y-1">
                              {subLink.subItems?.map((item) => (
                                <Link
                                  key={item.href}
                                  to={item.href}
                                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-[#1800AD]/10 hover:text-[#1800AD] rounded-md transition-all duration-150"
                                  onClick={() => setActiveDropdown(null)}
                                >
                                  {item.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Call Button - Desktop */}
          <a
            href={`tel:${PHONE_NUMBER}`}
            aria-label="Appeler Advisy par téléphone"
            className="hidden lg:flex items-center gap-2 bg-red-500 text-white font-semibold rounded-full px-5 py-2 shadow-lg transition-all duration-200 hover:-translate-y-[1px] hover:shadow-xl animate-call-blink"
          >
            <Phone className="w-4 h-4" />
            <span>Appeler-nous</span>
          </a>

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
        <div className="lg:hidden absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-md border border-gray-200 rounded-3xl shadow-lg animate-fade-in max-h-[80vh] overflow-y-auto z-50 mx-2">
          <div className="px-4 py-6 flex flex-col gap-2">
            {navLinks.map((link) => (
              <div key={link.label}>
                {link.type === "link" && link.href && (
                  <Link
                    to={link.href}
                    onClick={() => setIsOpen(false)}
                    className="text-base font-medium text-slate-800 hover:text-[#1800AD] hover:bg-[#1800AD]/10 transition-all duration-200 py-2 px-3 rounded-lg block"
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
                    className="text-base font-medium text-slate-800 hover:text-[#1800AD] hover:bg-[#1800AD]/10 transition-all duration-200 py-2 px-3 rounded-lg w-full text-left"
                  >
                    {link.label}
                  </button>
                )}

                {link.type === "dropdown" && link.subLinks && (
                  <div>
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === link.label ? null : link.label)}
                      className="text-base font-medium text-slate-800 hover:text-[#1800AD] hover:bg-[#1800AD]/10 transition-all duration-200 py-2 px-3 rounded-lg w-full flex items-center justify-between"
                    >
                      {link.label}
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === link.label ? 'rotate-180' : ''}`} />
                    </button>
                    {activeDropdown === link.label && (
                      <div className="pl-3 mt-2 space-y-2">
                        {link.subLinks.map((subLink) => (
                          <div key={subLink.label}>
                            <p className="text-xs font-semibold text-[#1800AD] uppercase mb-2 px-3">{subLink.label}</p>
                            <div className="space-y-1">
                              {subLink.subItems?.map((item) => (
                                <Link
                                  key={item.href}
                                  to={item.href}
                                  onClick={() => setIsOpen(false)}
                                  className="block px-3 py-2 text-sm text-slate-700 hover:bg-[#1800AD]/10 hover:text-[#1800AD] rounded-lg transition-all duration-150"
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
            
            {/* Call Button - Mobile */}
            <a
              href={`tel:${PHONE_NUMBER}`}
              onClick={() => setIsOpen(false)}
              aria-label="Appeler Advisy par téléphone"
              className="flex items-center justify-center gap-2 bg-red-500 text-white font-semibold rounded-full px-6 py-3 shadow-lg transition-all duration-200 animate-call-blink mt-4"
            >
              <Phone className="w-5 h-5" />
              <span>Appeler-nous: {PHONE_DISPLAY}</span>
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};
