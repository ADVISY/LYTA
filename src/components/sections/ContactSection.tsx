import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const ContactSection = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    profile: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.email) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    // Show success message
    toast({
      title: "Message envoyé !",
      description: "Nous vous recontacterons dans les plus brefs délais.",
    });

    // Reset form
    setFormData({
      name: "",
      email: "",
      phone: "",
      profile: "",
      subject: "",
      message: "",
    });
  };

  return (
    <section id="contact" className="py-20 lg:py-32 bg-gradient-subtle">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Parlons de votre situation
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Quelques informations suffisent pour que nous puissions revenir vers
            vous avec des premières pistes et un rendez-vous.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
          {/* Contact Form */}
          <div className="lg:col-span-2 animate-slide-up">
            <form
              onSubmit={handleSubmit}
              className="bg-card rounded-2xl p-8 lg:p-10 shadow-medium border border-border space-y-6"
            >
              {/* Name and Email */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Prénom et nom <span className="text-destructive">*</span>
                  </label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Jean Dupont"
                    className="h-12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="jean.dupont@email.ch"
                    className="h-12"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Téléphone
                </label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+41 xx xxx xx xx"
                  className="h-12"
                />
              </div>

              {/* Profile Type and Subject */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Type de profil
                  </label>
                  <Select
                    value={formData.profile}
                    onValueChange={(value) =>
                      setFormData({ ...formData, profile: value })
                    }
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="particulier">Particulier</SelectItem>
                      <SelectItem value="independant">Indépendant</SelectItem>
                      <SelectItem value="pme">PME</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Sujet principal
                  </label>
                  <Select
                    value={formData.subject}
                    onValueChange={(value) =>
                      setFormData({ ...formData, subject: value })
                    }
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maladie">Assurance maladie</SelectItem>
                      <SelectItem value="prevoyance">
                        Assurances & prévoyance
                      </SelectItem>
                      <SelectItem value="entreprise">
                        Indépendant / entreprise
                      </SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Message
                </label>
                <Textarea
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  placeholder="Décrivez brièvement votre situation..."
                  className="min-h-32 resize-none"
                />
              </div>

              {/* Submit Button */}
              <Button type="submit" size="lg" className="w-full">
                Envoyer ma demande
              </Button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="space-y-6 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <div className="bg-card rounded-2xl p-8 shadow-medium border border-border">
              <h3 className="text-xl font-bold text-foreground mb-6">
                Coordonnées
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email</p>
                    <a
                      href="mailto:contact@e-advisy.ch"
                      className="text-foreground hover:text-primary transition-colors font-medium"
                    >
                      contact@e-advisy.ch
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Téléphone
                    </p>
                    <a
                      href="tel:+41xxxxxxxxx"
                      className="text-foreground hover:text-primary transition-colors font-medium"
                    >
                      +41 xx xxx xx xx
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
