import advisyLogo from "@/assets/advisy-logo.svg";
import { Link } from "react-router-dom";
import { Mail, Phone, Clock } from "lucide-react";

export const Footer = () => {
  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const quickLinks = [
    { label: "Accueil", href: "/" },
    { label: "Assurances", href: "/assurances/sante" },
    { label: "À propos", href: "/a-propos" },
    { label: "Carrière", href: "/carriere" },
    { label: "Contact", href: "#contact", scroll: true },
    { label: "Connexion", href: "/connexion" },
  ];

  return (
    <footer className="bg-foreground text-background py-16 lg:py-20">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Column 1 - Logo & Description */}
          <div className="lg:col-span-1">
            <img 
              src={advisyLogo} 
              alt="Advisy" 
              className="h-16 w-auto object-contain brightness-0 invert opacity-90 mb-6"
            />
            <p className="text-sm text-background/70 leading-relaxed">
              Advisy, votre partenaire de confiance en assurance, prévoyance et financement en Suisse.
              Des conseils clairs, des solutions sur mesure et un accompagnement humain à chaque étape.
            </p>
          </div>

          {/* Column 2 - Quick Links */}
          <div>
            <h3 className="text-base font-bold text-background mb-4 uppercase tracking-wide">
              Liens rapides
            </h3>
            <div className="flex flex-col gap-3">
              {quickLinks.map((link) => (
                link.scroll ? (
                  <button
                    key={link.href}
                    onClick={() => scrollToSection(link.href)}
                    className="text-sm text-background/70 hover:text-background transition-colors text-left"
                  >
                    {link.label}
                  </button>
                ) : (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="text-sm text-background/70 hover:text-background transition-colors"
                  >
                    {link.label}
                  </Link>
                )
              ))}
            </div>
          </div>

          {/* Column 3 - Contact */}
          <div>
            <h3 className="text-base font-bold text-background mb-4 uppercase tracking-wide">
              Contact
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-primary-light" />
                <a href="tel:+41XXXXXXXXX" className="text-sm text-background/70 hover:text-background transition-colors">
                  +41 (XX) XXX XX XX
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-primary-light" />
                <a href="mailto:contact@advisy.ch" className="text-sm text-background/70 hover:text-background transition-colors">
                  contact@advisy.ch
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-primary-light" />
                <span className="text-sm text-background/70">
                  Lun–Ven : 08h30–18h00
                </span>
              </div>
            </div>
          </div>

          {/* Column 4 - Legal */}
          <div>
            <h3 className="text-base font-bold text-background mb-4 uppercase tracking-wide">
              Informations légales
            </h3>
            <div className="flex flex-col gap-3">
              <a href="#" className="text-sm text-background/70 hover:text-background transition-colors">
                Politique de confidentialité
              </a>
              <a href="#" className="text-sm text-background/70 hover:text-background transition-colors">
                Mentions légales
              </a>
              <a href="#" className="text-sm text-background/70 hover:text-background transition-colors">
                Conditions d'utilisation
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-background/20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-background/70 text-center md:text-left">
              © 2025 Advisy Suisse — Tous droits réservés.
            </p>
            <p className="text-sm text-background/70 text-center md:text-right">
              Advisy est un cabinet de conseil indépendant, enregistré en Suisse.
            </p>
          </div>
          <p className="text-xs text-background/50 text-center mt-4">
            Les comparaisons sont réalisées de manière neutre et conforme à la LCA.
            Les données transmises sont confidentielles et utilisées uniquement dans le cadre de votre demande.
          </p>
        </div>
      </div>
    </footer>
  );
};
