import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Upload, FileCheck, Send } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import advisyLogo from "@/assets/advisy-logo.svg";
import { supabase } from "@/integrations/supabase/client";
import { useInsuranceCompanies } from "@/hooks/useInsuranceCompanies";

const PartnerContractSubmit = () => {
  const [step, setStep] = useState<"email" | "form">("email");
  const [email, setEmail] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  
  // Form fields
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [productType, setProductType] = useState("");
  const [premiumMonthly, setPremiumMonthly] = useState("");
  const [notes, setNotes] = useState("");
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { companies } = useInsuranceCompanies();

  const handleEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer votre adresse email.",
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);

    try {
      // Check if this email belongs to a partner
      const { data: partner, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, company_name')
        .eq('email', email)
        .eq('type_adresse', 'partenaire')
        .maybeSingle();

      if (error) throw error;

      if (partner) {
        setPartnerId(partner.id);
        setPartnerName(partner.company_name || `${partner.first_name} ${partner.last_name}`);
        setStep("form");
        toast({
          title: "Email vérifié",
          description: `Bienvenue ${partner.company_name || partner.first_name}`,
        });
      } else {
        toast({
          title: "Email non reconnu",
          description: "Cet email n'est pas associé à un compte partenaire. Contactez Advisy pour vous inscrire.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmitContract = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientFirstName || !clientLastName || !companyId || !productType) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create a proposition (contrat en attente)
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          first_name: clientFirstName,
          last_name: clientLastName,
          email: clientEmail || null,
          mobile: clientPhone || null,
          type_adresse: 'client',
          status: 'prospect',
        })
        .select('id')
        .single();

      if (clientError) throw clientError;

      // Create proposition
      const selectedCompany = companies.find(c => c.id === companyId);
      
      const { error: propositionError } = await supabase
        .from('propositions')
        .insert({
          client_id: client.id,
          company_name: selectedCompany?.name || '',
          product_type: productType,
          monthly_premium: premiumMonthly ? parseFloat(premiumMonthly) : null,
          yearly_premium: premiumMonthly ? parseFloat(premiumMonthly) * 12 : null,
          status: 'pending',
        });

      if (propositionError) throw propositionError;

      toast({
        title: "Contrat déposé",
        description: "Votre proposition de contrat a été envoyée à Advisy pour traitement.",
      });

      // Reset form
      setClientFirstName("");
      setClientLastName("");
      setClientEmail("");
      setClientPhone("");
      setCompanyId("");
      setProductType("");
      setPremiumMonthly("");
      setNotes("");
      
      // Show success message
      navigate("/connexion");
      
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors du dépôt.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/images/bg-pattern-gray.png')] opacity-40" />
      
      <Link 
        to="/connexion" 
        className="absolute top-6 left-6 inline-flex items-center gap-2 text-sm font-medium text-foreground bg-card rounded-full px-4 py-2 shadow-sm border hover:shadow-md transition-all z-10"
      >
        <ChevronLeft className="w-4 h-4" />
        Retour
      </Link>

      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-8 animate-fade-in">
          <img 
            src={advisyLogo} 
            alt="Advisy" 
            className="h-24 sm:h-32 mx-auto mb-6"
          />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Déposer un contrat
          </h1>
          <p className="text-muted-foreground">
            {step === "email" 
              ? "Identifiez-vous avec votre email partenaire" 
              : `Partenaire: ${partnerName}`}
          </p>
        </div>

        <div className="max-w-xl w-full bg-card rounded-lg shadow-lg border p-6 sm:p-8 animate-scale-in">
          {step === "email" ? (
            <form onSubmit={handleEmailVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="partner-email">Email partenaire</Label>
                <Input
                  id="partner-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@entreprise.ch"
                />
              </div>

              <Button 
                type="submit" 
                disabled={verifying}
                className="w-full mt-6"
              >
                {verifying ? "Vérification..." : "Continuer"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmitContract} className="space-y-6">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg mb-4">
                <FileCheck className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Nouveau contrat pour {partnerName}</span>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Informations client</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="clientFirstName">Prénom *</Label>
                    <Input
                      id="clientFirstName"
                      value={clientFirstName}
                      onChange={(e) => setClientFirstName(e.target.value)}
                      placeholder="Jean"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientLastName">Nom *</Label>
                    <Input
                      id="clientLastName"
                      value={clientLastName}
                      onChange={(e) => setClientLastName(e.target.value)}
                      placeholder="Dupont"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="clientEmail">Email</Label>
                    <Input
                      id="clientEmail"
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="client@email.ch"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientPhone">Téléphone</Label>
                    <Input
                      id="clientPhone"
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+41 79 123 45 67"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Informations contrat</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Compagnie *</Label>
                    <Select value={companyId} onValueChange={setCompanyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type de produit *</Label>
                    <Select value={productType} onValueChange={setProductType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="health">Santé (LAMal/LCA)</SelectItem>
                        <SelectItem value="life">Vie / 3e pilier</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="property">RC / Ménage</SelectItem>
                        <SelectItem value="legal">Protection juridique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="premiumMonthly">Prime mensuelle (CHF)</Label>
                  <Input
                    id="premiumMonthly"
                    type="number"
                    value={premiumMonthly}
                    onChange={(e) => setPremiumMonthly(e.target.value)}
                    placeholder="350.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes / Commentaires</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Informations complémentaires sur le contrat..."
                    rows={3}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {loading ? "Envoi en cours..." : "Déposer le contrat"}
              </Button>

              <button
                type="button"
                onClick={() => setStep("email")}
                className="w-full text-sm text-muted-foreground hover:text-foreground text-center"
              >
                Changer de partenaire
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default PartnerContractSubmit;