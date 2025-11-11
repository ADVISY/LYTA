import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import advisyTextLogo from "@/assets/advisy-text-logo.svg";
import { 
  Briefcase, 
  Rocket, 
  Shield, 
  TrendingUp, 
  Target, 
  Zap, 
  Users, 
  MessageSquare,
  Award,
  Laptop,
  UserCheck,
  HeartHandshake
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const candidatureSchema = z.object({
  nom: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(100),
  email: z.string().trim().email("Email invalide").max(255),
  telephone: z.string().trim().min(10, "Numéro invalide").max(20),
  statut: z.string().min(1, "Veuillez sélectionner un statut"),
  message: z.string().trim().min(10, "Le message doit contenir au moins 10 caractères").max(2000),
});

type CandidatureFormData = z.infer<typeof candidatureSchema>;

const Carriere = () => {
  const { register, handleSubmit, formState: { errors }, setValue, reset } = useForm<CandidatureFormData>({
    resolver: zodResolver(candidatureSchema),
  });

  const onSubmit = (data: CandidatureFormData) => {
    console.log("Candidature:", data);
    toast.success("Candidature envoyée avec succès !");
    reset();
  };

  const scrollToCandidature = () => {
    const section = document.getElementById("candidature");
    section?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <main>
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden pt-32 pb-20">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 -z-10" />
          <div className="absolute top-20 right-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] -z-10 animate-pulse" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-accent/10 rounded-full blur-[120px] -z-10 animate-pulse" style={{ animationDelay: '1s' }} />
          
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-5xl mx-auto text-center space-y-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Rocket className="w-5 h-5 text-primary" />
                <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                  Carrières
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight">
                Rejoindre <img src={advisyTextLogo} alt="Advisy" className="h-14 md:h-20 object-contain inline-block mx-2" />
              </h1>

              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
                Construis ta carrière dans le conseil en assurance et finance, avec des moyens à la hauteur de tes ambitions.
              </p>

              <Button 
                size="lg" 
                className="mt-8 text-lg px-8 py-6 rounded-full shadow-glow hover:scale-105 transition-transform"
                onClick={scrollToCandidature}
              >
                <Users className="w-5 h-5 mr-2" />
                Rejoindre l'équipe
              </Button>
            </div>
          </div>
        </section>

        {/* Section 1 - Pourquoi travailler avec Advisy */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16 space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                Pourquoi travailler avec <img src={advisyTextLogo} alt="Advisy" className="h-12 md:h-14 object-contain inline-block mx-2" /> ?
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Chez Advisy, nous proposons une solution clé en main pour bâtir une carrière solide et pérenne. 
                Un accompagnement structuré, une ambition forte et des outils modernes pour te faire réussir.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-2">
                <CardHeader>
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                    <Briefcase className="w-8 h-8 text-blue-500" />
                  </div>
                  <CardTitle className="text-2xl">Solution clé en main</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    Une solution clé en main et un accompagnement précis pour remplir vos objectifs, 
                    avec un suivi structuré et des objectifs clairs.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-2">
                <CardHeader>
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Target className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Ambition dans le détail du conseil</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    Une ambition directionnelle forte : aller plus loin dans le détail du conseil, 
                    la qualité de l'analyse et le service client.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-2">
                <CardHeader>
                  <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
                    <Zap className="w-8 h-8 text-green-500" />
                  </div>
                  <CardTitle className="text-2xl">Back office moderne et rapide</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    Un back-office moderne, avancé et rapide pour vous faire gagner du temps et sécuriser vos dossiers.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Section 2 - Outils et leads */}
        <section className="py-20 lg:py-32 bg-gradient-subtle">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                Des outils et des moyens concrets
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
              <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -z-0 group-hover:bg-purple-500/20 transition-colors" />
                <CardHeader className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
                    <Laptop className="w-8 h-8 text-purple-500" />
                  </div>
                  <CardTitle className="text-2xl">Outils digitaux à la pointe</CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <CardDescription className="text-base leading-relaxed">
                    Des outils digitaux à la pointe de la technologie pour piloter votre activité, 
                    suivre vos clients et préparer vos rendez-vous.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -z-0 group-hover:bg-orange-500/20 transition-colors" />
                <CardHeader className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4">
                    <UserCheck className="w-8 h-8 text-orange-500" />
                  </div>
                  <CardTitle className="text-2xl">Leads ultra qualifiés</CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <CardDescription className="text-base leading-relaxed">
                    Des leads ultra qualifiés, issus de notre site de comparateur conçu spécialement pour l'équipe. 
                    Moins de prospection à froid, plus de conseils de qualité.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Section 3 - Rémunération et évolution */}
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                Rémunération & évolution
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-primary/20">
                <CardHeader>
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                    <TrendingUp className="w-8 h-8 text-emerald-500" />
                  </div>
                  <CardTitle className="text-2xl">Commissions non plafonnées</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    Votre rémunération suit réellement vos résultats, sans plafond artificiel.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-primary/20">
                <CardHeader>
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                    <Shield className="w-8 h-8 text-blue-500" />
                  </div>
                  <CardTitle className="text-2xl">Primes et base fixe (inscrits FINMA)</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    Pour les personnes inscrites à la FINMA, une base fixe est prévue, 
                    accompagnée de primes liées à la qualité de vos affaires.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-primary/20">
                <CardHeader>
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition-colors">
                    <Award className="w-8 h-8 text-violet-500" />
                  </div>
                  <CardTitle className="text-2xl">Évolution managériale possible</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    Une évolution managériale est possible en fonction de la qualité de vos affaires, 
                    de votre perception du domaine et de l'engouement que vous générez pour l'entreprise.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Section 4 - Accompagnement & culture */}
        <section className="py-20 lg:py-32 bg-gradient-subtle">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                  Accompagnement & culture
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Chez Advisy, vous n'êtes pas livré à vous-même. Un accompagnement précis vous aide à progresser 
                  sur le terrain, dans votre discours et dans votre organisation. L'objectif : vous amener à un haut 
                  niveau de qualité de conseil et de service client.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8 mt-16">
                <div className="text-center space-y-4 group">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                    <Users className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">Coaching régulier</h3>
                  <p className="text-muted-foreground">Accompagnement personnalisé et suivi continu</p>
                </div>

                <div className="text-center space-y-4 group">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                    <MessageSquare className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">Feedback concret</h3>
                  <p className="text-muted-foreground">Retours constructifs pour progresser rapidement</p>
                </div>

                <div className="text-center space-y-4 group">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                    <HeartHandshake className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">Culture de la qualité</h3>
                  <p className="text-muted-foreground">Excellence et satisfaction client au cœur de nos valeurs</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5 - Candidature */}
        <section id="candidature" className="py-20 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12 space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                  Prêt à rejoindre l'équipe ?
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Vous voulez un cadre sérieux, des outils modernes et une vraie perspective d'évolution ? 
                  Envoyez-nous votre candidature et voyons si nous avançons ensemble.
                </p>
              </div>

              <Card className="shadow-xl">
                <CardContent className="p-8">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="nom">Nom complet *</Label>
                      <Input 
                        id="nom" 
                        placeholder="Votre nom complet"
                        {...register("nom")}
                        className={errors.nom ? "border-red-500" : ""}
                      />
                      {errors.nom && <p className="text-sm text-red-500">{errors.nom.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input 
                        id="email" 
                        type="email"
                        placeholder="votre@email.com"
                        {...register("email")}
                        className={errors.email ? "border-red-500" : ""}
                      />
                      {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="telephone">Téléphone *</Label>
                      <Input 
                        id="telephone" 
                        type="tel"
                        placeholder="+41 XX XXX XX XX"
                        {...register("telephone")}
                        className={errors.telephone ? "border-red-500" : ""}
                      />
                      {errors.telephone && <p className="text-sm text-red-500">{errors.telephone.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="statut">Statut *</Label>
                      <Select onValueChange={(value) => setValue("statut", value)}>
                        <SelectTrigger className={errors.statut ? "border-red-500" : ""}>
                          <SelectValue placeholder="Sélectionnez votre statut" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inscrit-finma">Inscrit FINMA</SelectItem>
                          <SelectItem value="non-inscrit-finma">Non inscrit FINMA</SelectItem>
                          <SelectItem value="reconversion">En reconversion</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.statut && <p className="text-sm text-red-500">{errors.statut.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message / Motivation *</Label>
                      <Textarea 
                        id="message" 
                        placeholder="Parlez-nous de vos motivations et de votre parcours..."
                        rows={6}
                        {...register("message")}
                        className={errors.message ? "border-red-500" : ""}
                      />
                      {errors.message && <p className="text-sm text-red-500">{errors.message.message}</p>}
                    </div>

                    <Button 
                      type="submit" 
                      size="lg" 
                      className="w-full text-lg rounded-full shadow-glow hover:scale-[1.02] transition-transform"
                    >
                      <Rocket className="w-5 h-5 mr-2" />
                      Envoyer ma candidature
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Carriere;
