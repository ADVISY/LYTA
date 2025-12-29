import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCelebration } from "@/hooks/useCelebration";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  FileCheck, 
  Loader2, 
  Search, 
  User, 
  Building2, 
  Check,
  Heart,
  Shield,
  Briefcase,
  Upload,
  AlertCircle,
  Mail,
  LogOut
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import lytaLogo from "@/assets/lyta-logo.svg";

type Client = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
};

type VerifiedPartner = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
};

// Form types for each category
type SanaFormData = {
  clientName: string;
  clientPrenom: string;
  clientEmail: string;
  clientTel: string;
  lamalDateEffet: string;
  lcaDateEffet: string;
  lcaProduction: string;
  agentName: string;
  commentaires: string;
  confirmDocuments: boolean;
};

type VitaFormData = {
  clientName: string;
  clientPrenom: string;
  clientEmail: string;
  clientTel: string;
  vitaDateEffet: string;
  vitaDureeContrat: string;
  vitaPrimeMensuelle: string;
  agentName: string;
  commentaires: string;
  confirmDocuments: boolean;
};

type MedioFormData = {
  clientName: string;
  clientPrenom: string;
  clientEmail: string;
  clientTel: string;
  dateEffet: string;
  typeCouverture: string;
  production: string;
  agentName: string;
  commentaires: string;
  confirmDocuments: boolean;
};

type BusinessFormData = {
  entrepriseNom: string;
  entrepriseActivite: string;
  formeSociete: string;
  nouvelleCreation: string;
  entrepriseAdresse: string;
  chefPrenom: string;
  chefNom: string;
  civilite: string;
  dateNaissance: string;
  chefAdresse: string;
  nationalite: string;
  permis: string;
  // RC
  offreRC: string;
  assureurPrecedentRC: string;
  typeContratRC: string;
  chiffreAffaire: string;
  sommeAssuranceRC: string;
  franchiseRC: string;
  commentairesRC: string;
  // Assurance choses
  offreChoses: string;
  assureurPrecedentChoses: string;
  incendie: boolean;
  incendieValeur: string;
  evenementsNaturels: boolean;
  evenementsNaturelsValeur: string;
  vol: boolean;
  volValeur: string;
  degatEau: boolean;
  degatEauValeur: string;
  commentairesChoses: string;
  // Assurance personnes
  offrePersonnes: string;
  nbFemmes: string;
  ageMoyenFemmes: string;
  salairesFemmes: string;
  nbHommes: string;
  ageMoyenHommes: string;
  salairesHommes: string;
  offreLAA: string;
  offreLAAComplementaire: string;
  offrePerteGain: string;
  offreChefEntreprise: string;
  compagnies: string[];
  dateRDV: string;
  dateEffet: string;
  langue: string;
  emailRetour: string;
  commentaires: string;
  inclureCGA: string;
};

export default function DeposerContrat() {
  const navigate = useNavigate();
  const { celebrate } = useCelebration();
  const { toast } = useToast();

  // Email verification state
  const [verificationStep, setVerificationStep] = useState<'email' | 'form'>('email');
  const [partnerEmail, setPartnerEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifiedPartner, setVerifiedPartner] = useState<VerifiedPartner | null>(null);

  const [activeTab, setActiveTab] = useState("sana");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");

  // SANA Form
  const [sanaForm, setSanaForm] = useState<SanaFormData>({
    clientName: "",
    clientPrenom: "",
    clientEmail: "",
    clientTel: "",
    lamalDateEffet: "",
    lcaDateEffet: "",
    lcaProduction: "",
    agentName: "",
    commentaires: "",
    confirmDocuments: false,
  });

  // VITA Form
  const [vitaForm, setVitaForm] = useState<VitaFormData>({
    clientName: "",
    clientPrenom: "",
    clientEmail: "",
    clientTel: "",
    vitaDateEffet: "",
    vitaDureeContrat: "",
    vitaPrimeMensuelle: "",
    agentName: "",
    commentaires: "",
    confirmDocuments: false,
  });

  // MEDIO Form  
  const [medioForm, setMedioForm] = useState<MedioFormData>({
    clientName: "",
    clientPrenom: "",
    clientEmail: "",
    clientTel: "",
    dateEffet: "",
    typeCouverture: "",
    production: "",
    agentName: "",
    commentaires: "",
    confirmDocuments: false,
  });

  // BUSINESS Form
  const [businessForm, setBusinessForm] = useState<BusinessFormData>({
    entrepriseNom: "",
    entrepriseActivite: "",
    formeSociete: "",
    nouvelleCreation: "",
    entrepriseAdresse: "",
    chefPrenom: "",
    chefNom: "",
    civilite: "",
    dateNaissance: "",
    chefAdresse: "",
    nationalite: "",
    permis: "",
    offreRC: "",
    assureurPrecedentRC: "",
    typeContratRC: "",
    chiffreAffaire: "",
    sommeAssuranceRC: "",
    franchiseRC: "",
    commentairesRC: "",
    offreChoses: "",
    assureurPrecedentChoses: "",
    incendie: false,
    incendieValeur: "",
    evenementsNaturels: false,
    evenementsNaturelsValeur: "",
    vol: false,
    volValeur: "",
    degatEau: false,
    degatEauValeur: "",
    commentairesChoses: "",
    offrePersonnes: "",
    nbFemmes: "",
    ageMoyenFemmes: "",
    salairesFemmes: "",
    nbHommes: "",
    ageMoyenHommes: "",
    salairesHommes: "",
    offreLAA: "",
    offreLAAComplementaire: "",
    offrePerteGain: "",
    offreChefEntreprise: "",
    compagnies: [],
    dateRDV: "",
    dateEffet: "",
    langue: "fr",
    emailRetour: "",
    commentaires: "",
    inclureCGA: "",
  });

  // Load clients when verified
  useEffect(() => {
    if (verifiedPartner) {
      loadClients();
    }
  }, [verifiedPartner]);

  // Set agent name when partner is verified
  useEffect(() => {
    if (verifiedPartner) {
      const agentName = verifiedPartner.name || `${verifiedPartner.firstName || ''} ${verifiedPartner.lastName || ''}`.trim();
      setSanaForm(prev => ({ ...prev, agentName }));
      setVitaForm(prev => ({ ...prev, agentName }));
      setMedioForm(prev => ({ ...prev, agentName }));
    }
  }, [verifiedPartner]);

  const handleVerifyEmail = async () => {
    if (!partnerEmail.trim()) {
      toast({
        title: "Email requis",
        description: "Veuillez entrer votre adresse email",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(partnerEmail.trim())) {
      toast({
        title: "Email invalide",
        description: "Veuillez entrer une adresse email valide",
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-partner-email', {
        body: { email: partnerEmail.trim().toLowerCase() }
      });

      if (error) {
        throw new Error(error.message || "Erreur de vérification");
      }

      if (data?.success && data?.partner) {
        setVerifiedPartner(data.partner);
        setVerificationStep('form');
        toast({
          title: "Bienvenue !",
          description: `Accès autorisé pour ${data.partner.name}`,
        });
      } else {
        toast({
          title: "Accès refusé",
          description: "Cet email n'est pas enregistré comme collaborateur LYTA",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de vérifier l'email",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    setVerifiedPartner(null);
    setVerificationStep('email');
    setPartnerEmail("");
    setClients([]);
    setSelectedClientId("");
  };

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, last_name, company_name, email, phone, mobile")
        .neq("type_adresse", "collaborateur")
        .order("last_name");
      if (data) setClients(data);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter((client) => {
    if (!clientSearch) return true;
    const search = clientSearch.toLowerCase();
    const fullName = `${client.first_name || ""} ${client.last_name || ""}`.toLowerCase();
    const companyName = (client.company_name || "").toLowerCase();
    const email = (client.email || "").toLowerCase();
    return fullName.includes(search) || companyName.includes(search) || email.includes(search);
  });

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const getClientName = (client: Client) => {
    if (client.company_name) return client.company_name;
    return `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Sans nom";
  };

  // When client is selected, prefill form data
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const clientName = client.last_name || "";
      const clientPrenom = client.first_name || "";
      const clientEmail = client.email || "";
      const clientTel = client.mobile || client.phone || "";

      setSanaForm(prev => ({
        ...prev,
        clientName,
        clientPrenom,
        clientEmail,
        clientTel,
      }));
      setVitaForm(prev => ({
        ...prev,
        clientName,
        clientPrenom,
        clientEmail,
        clientTel,
      }));
      setMedioForm(prev => ({
        ...prev,
        clientName,
        clientPrenom,
        clientEmail,
        clientTel,
      }));
    }
  };

  const handleSubmitSana = async () => {
    if (!sanaForm.clientName || !sanaForm.clientPrenom || !sanaForm.clientEmail) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }
    if (!sanaForm.confirmDocuments) {
      toast({
        title: "Confirmation requise",
        description: "Veuillez confirmer avoir téléchargé tous les documents requis",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Create a policy record
      const { error } = await supabase.from("policies").insert({
        client_id: selectedClientId || null,
        product_id: "00000000-0000-0000-0000-000000000001", // Placeholder
        start_date: sanaForm.lamalDateEffet || new Date().toISOString().split("T")[0],
        status: "pending",
        notes: `SANA - Agent: ${sanaForm.agentName}\nEmail Agent: ${partnerEmail}\nLAMal Date: ${sanaForm.lamalDateEffet}\nLCA Date: ${sanaForm.lcaDateEffet}\nLCA Production: ${sanaForm.lcaProduction}\n${sanaForm.commentaires}`,
        product_type: "sana",
      });

      if (error) throw error;

      celebrate("contract_added");
      toast({
        title: "Formulaire SANA envoyé !",
        description: "Votre demande a été soumise avec succès",
      });

      // Reset form
      setSanaForm({
        clientName: "",
        clientPrenom: "",
        clientEmail: "",
        clientTel: "",
        lamalDateEffet: "",
        lcaDateEffet: "",
        lcaProduction: "",
        agentName: verifiedPartner?.name || "",
        commentaires: "",
        confirmDocuments: false,
      });
      setSelectedClientId("");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de soumettre le formulaire",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitVita = async () => {
    if (!vitaForm.clientName || !vitaForm.clientPrenom || !vitaForm.clientEmail) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }
    if (!vitaForm.confirmDocuments) {
      toast({
        title: "Confirmation requise",
        description: "Veuillez confirmer avoir téléchargé tous les documents requis",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("policies").insert({
        client_id: selectedClientId || null,
        product_id: "00000000-0000-0000-0000-000000000002", // Placeholder
        start_date: vitaForm.vitaDateEffet || new Date().toISOString().split("T")[0],
        premium_monthly: parseFloat(vitaForm.vitaPrimeMensuelle) || 0,
        status: "pending",
        notes: `VITA - Agent: ${vitaForm.agentName}\nEmail Agent: ${partnerEmail}\nDurée: ${vitaForm.vitaDureeContrat}\n${vitaForm.commentaires}`,
        product_type: "vita",
      });

      if (error) throw error;

      celebrate("contract_added");
      toast({
        title: "Formulaire VITA envoyé !",
        description: "Votre demande a été soumise avec succès",
      });

      setVitaForm({
        clientName: "",
        clientPrenom: "",
        clientEmail: "",
        clientTel: "",
        vitaDateEffet: "",
        vitaDureeContrat: "",
        vitaPrimeMensuelle: "",
        agentName: verifiedPartner?.name || "",
        commentaires: "",
        confirmDocuments: false,
      });
      setSelectedClientId("");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de soumettre le formulaire",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMedio = async () => {
    if (!medioForm.clientName || !medioForm.clientPrenom || !medioForm.clientEmail) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }
    if (!medioForm.confirmDocuments) {
      toast({
        title: "Confirmation requise",
        description: "Veuillez confirmer avoir téléchargé tous les documents requis",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("policies").insert({
        client_id: selectedClientId || null,
        product_id: "00000000-0000-0000-0000-000000000003", // Placeholder
        start_date: medioForm.dateEffet || new Date().toISOString().split("T")[0],
        status: "pending",
        notes: `MEDIO - Agent: ${medioForm.agentName}\nEmail Agent: ${partnerEmail}\nType: ${medioForm.typeCouverture}\nProduction: ${medioForm.production}\n${medioForm.commentaires}`,
        product_type: "medio",
      });

      if (error) throw error;

      celebrate("contract_added");
      toast({
        title: "Formulaire MEDIO envoyé !",
        description: "Votre demande a été soumise avec succès",
      });

      setMedioForm({
        clientName: "",
        clientPrenom: "",
        clientEmail: "",
        clientTel: "",
        dateEffet: "",
        typeCouverture: "",
        production: "",
        agentName: verifiedPartner?.name || "",
        commentaires: "",
        confirmDocuments: false,
      });
      setSelectedClientId("");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de soumettre le formulaire",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBusiness = async () => {
    if (!businessForm.entrepriseNom || !businessForm.chefPrenom || !businessForm.chefNom) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir les informations de l'entreprise et du chef d'entreprise",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("policies").insert({
        client_id: selectedClientId || null,
        product_id: "00000000-0000-0000-0000-000000000004", // Placeholder
        start_date: businessForm.dateEffet || new Date().toISOString().split("T")[0],
        status: "pending",
        notes: `BUSINESS - Email Agent: ${partnerEmail}\nEntreprise: ${businessForm.entrepriseNom}\nChef: ${businessForm.chefPrenom} ${businessForm.chefNom}\nActivité: ${businessForm.entrepriseActivite}\n${businessForm.commentaires}`,
        product_type: "business",
        products_data: businessForm,
      });

      if (error) throw error;

      celebrate("contract_added");
      toast({
        title: "Formulaire BUSINESS envoyé !",
        description: "Votre demande a été soumise avec succès",
      });

      setBusinessForm({
        entrepriseNom: "",
        entrepriseActivite: "",
        formeSociete: "",
        nouvelleCreation: "",
        entrepriseAdresse: "",
        chefPrenom: "",
        chefNom: "",
        civilite: "",
        dateNaissance: "",
        chefAdresse: "",
        nationalite: "",
        permis: "",
        offreRC: "",
        assureurPrecedentRC: "",
        typeContratRC: "",
        chiffreAffaire: "",
        sommeAssuranceRC: "",
        franchiseRC: "",
        commentairesRC: "",
        offreChoses: "",
        assureurPrecedentChoses: "",
        incendie: false,
        incendieValeur: "",
        evenementsNaturels: false,
        evenementsNaturelsValeur: "",
        vol: false,
        volValeur: "",
        degatEau: false,
        degatEauValeur: "",
        commentairesChoses: "",
        offrePersonnes: "",
        nbFemmes: "",
        ageMoyenFemmes: "",
        salairesFemmes: "",
        nbHommes: "",
        ageMoyenHommes: "",
        salairesHommes: "",
        offreLAA: "",
        offreLAAComplementaire: "",
        offrePerteGain: "",
        offreChefEntreprise: "",
        compagnies: [],
        dateRDV: "",
        dateEffet: "",
        langue: "fr",
        emailRetour: "",
        commentaires: "",
        inclureCGA: "",
      });
      setSelectedClientId("");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de soumettre le formulaire",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Email verification screen
  if (verificationStep === 'email') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={lytaLogo} alt="LYTA" className="h-8" />
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="container py-16 max-w-md">
          <Card className="border-2">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Accès Collaborateurs</CardTitle>
              <CardDescription>
                Entrez votre adresse email professionnelle pour accéder au formulaire de dépôt de contrat
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre.email@exemple.com"
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleVerifyEmail();
                    }
                  }}
                  disabled={verifying}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleVerifyEmail}
                disabled={verifying}
              >
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Vérifier mon accès
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Seuls les collaborateurs enregistrés chez LYTA peuvent déposer des contrats
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Loading state while fetching clients
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={lytaLogo} alt="LYTA" className="h-8" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{verifiedPartner?.name}</span>
            </div>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Formulaire de production LYTA</h1>
          <p className="text-muted-foreground mt-2">Soumettez votre production selon le type de contrat</p>
        </div>

        {/* Client Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Sélectionner un client (optionnel)
            </CardTitle>
            <CardDescription>Préremplir les informations depuis un client existant</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un client..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {selectedClient && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{getClientName(selectedClient)}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedClientId("")}
                    className="h-6 w-6 p-0"
                  >
                    ×
                  </Button>
                </div>
              )}
            </div>
            {clientSearch && !selectedClientId && (
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                {filteredClients.slice(0, 10).map((client) => (
                  <button
                    key={client.id}
                    onClick={() => {
                      handleClientSelect(client.id);
                      setClientSearch("");
                    }}
                    className="w-full p-3 text-left hover:bg-muted transition-colors border-b last:border-b-0"
                  >
                    <p className="font-medium">{getClientName(client)}</p>
                    {client.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <p className="p-3 text-center text-muted-foreground">Aucun client trouvé</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for different form types */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sana" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">SANA</span>
            </TabsTrigger>
            <TabsTrigger value="vita" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              <span className="hidden sm:inline">VITA</span>
            </TabsTrigger>
            <TabsTrigger value="medio" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              <span className="hidden sm:inline">MEDIO</span>
            </TabsTrigger>
            <TabsTrigger value="business" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">BUSINESS</span>
            </TabsTrigger>
          </TabsList>

          {/* SANA Tab */}
          <TabsContent value="sana">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-500" />
                  Formulaire SANA - Assurance Maladie
                </CardTitle>
                <CardDescription>
                  Pour les contrats LAMal et LCA
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Client Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sana-nom">Nom du client *</Label>
                    <Input
                      id="sana-nom"
                      value={sanaForm.clientName}
                      onChange={(e) => setSanaForm(prev => ({ ...prev, clientName: e.target.value }))}
                      placeholder="Nom de famille"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sana-prenom">Prénom du client *</Label>
                    <Input
                      id="sana-prenom"
                      value={sanaForm.clientPrenom}
                      onChange={(e) => setSanaForm(prev => ({ ...prev, clientPrenom: e.target.value }))}
                      placeholder="Prénom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sana-email">Email du client *</Label>
                    <Input
                      id="sana-email"
                      type="email"
                      value={sanaForm.clientEmail}
                      onChange={(e) => setSanaForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                      placeholder="email@exemple.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sana-tel">Téléphone</Label>
                    <Input
                      id="sana-tel"
                      value={sanaForm.clientTel}
                      onChange={(e) => setSanaForm(prev => ({ ...prev, clientTel: e.target.value }))}
                      placeholder="+41 79 000 00 00"
                    />
                  </div>
                </div>

                {/* Contract Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sana-lamal-date">Date d'effet LAMal</Label>
                    <Input
                      id="sana-lamal-date"
                      type="date"
                      value={sanaForm.lamalDateEffet}
                      onChange={(e) => setSanaForm(prev => ({ ...prev, lamalDateEffet: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sana-lca-date">Date d'effet LCA</Label>
                    <Input
                      id="sana-lca-date"
                      type="date"
                      value={sanaForm.lcaDateEffet}
                      onChange={(e) => setSanaForm(prev => ({ ...prev, lcaDateEffet: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sana-lca-prod">Production LCA (CHF)</Label>
                    <Input
                      id="sana-lca-prod"
                      type="number"
                      value={sanaForm.lcaProduction}
                      onChange={(e) => setSanaForm(prev => ({ ...prev, lcaProduction: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sana-agent">Nom de l'agent</Label>
                    <Input
                      id="sana-agent"
                      value={sanaForm.agentName}
                      onChange={(e) => setSanaForm(prev => ({ ...prev, agentName: e.target.value }))}
                      placeholder="Votre nom"
                    />
                  </div>
                </div>

                {/* Comments */}
                <div className="space-y-2">
                  <Label htmlFor="sana-comments">Commentaires</Label>
                  <Textarea
                    id="sana-comments"
                    value={sanaForm.commentaires}
                    onChange={(e) => setSanaForm(prev => ({ ...prev, commentaires: e.target.value }))}
                    placeholder="Informations complémentaires..."
                    rows={3}
                  />
                </div>

                {/* Document confirmation */}
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="sana-confirm"
                    checked={sanaForm.confirmDocuments}
                    onCheckedChange={(checked) => 
                      setSanaForm(prev => ({ ...prev, confirmDocuments: checked as boolean }))
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor="sana-confirm" className="font-medium cursor-pointer">
                      Je confirme avoir téléchargé tous les documents requis
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Carte d'identité, attestation de résidence, bulletins de salaire, etc.
                    </p>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSubmitSana}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Soumettre le formulaire SANA
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VITA Tab */}
          <TabsContent value="vita">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Formulaire VITA - Assurance Vie
                </CardTitle>
                <CardDescription>
                  Pour les contrats d'assurance vie
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Client Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vita-nom">Nom du client *</Label>
                    <Input
                      id="vita-nom"
                      value={vitaForm.clientName}
                      onChange={(e) => setVitaForm(prev => ({ ...prev, clientName: e.target.value }))}
                      placeholder="Nom de famille"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vita-prenom">Prénom du client *</Label>
                    <Input
                      id="vita-prenom"
                      value={vitaForm.clientPrenom}
                      onChange={(e) => setVitaForm(prev => ({ ...prev, clientPrenom: e.target.value }))}
                      placeholder="Prénom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vita-email">Email du client *</Label>
                    <Input
                      id="vita-email"
                      type="email"
                      value={vitaForm.clientEmail}
                      onChange={(e) => setVitaForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                      placeholder="email@exemple.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vita-tel">Téléphone</Label>
                    <Input
                      id="vita-tel"
                      value={vitaForm.clientTel}
                      onChange={(e) => setVitaForm(prev => ({ ...prev, clientTel: e.target.value }))}
                      placeholder="+41 79 000 00 00"
                    />
                  </div>
                </div>

                {/* Contract Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vita-date">Date d'effet</Label>
                    <Input
                      id="vita-date"
                      type="date"
                      value={vitaForm.vitaDateEffet}
                      onChange={(e) => setVitaForm(prev => ({ ...prev, vitaDateEffet: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vita-duree">Durée du contrat</Label>
                    <Select
                      value={vitaForm.vitaDureeContrat}
                      onValueChange={(value) => setVitaForm(prev => ({ ...prev, vitaDureeContrat: value }))}
                    >
                      <SelectTrigger id="vita-duree">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 ans</SelectItem>
                        <SelectItem value="10">10 ans</SelectItem>
                        <SelectItem value="15">15 ans</SelectItem>
                        <SelectItem value="20">20 ans</SelectItem>
                        <SelectItem value="25">25 ans</SelectItem>
                        <SelectItem value="30">30 ans</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vita-prime">Prime mensuelle (CHF)</Label>
                    <Input
                      id="vita-prime"
                      type="number"
                      value={vitaForm.vitaPrimeMensuelle}
                      onChange={(e) => setVitaForm(prev => ({ ...prev, vitaPrimeMensuelle: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vita-agent">Nom de l'agent</Label>
                  <Input
                    id="vita-agent"
                    value={vitaForm.agentName}
                    onChange={(e) => setVitaForm(prev => ({ ...prev, agentName: e.target.value }))}
                    placeholder="Votre nom"
                  />
                </div>

                {/* Comments */}
                <div className="space-y-2">
                  <Label htmlFor="vita-comments">Commentaires</Label>
                  <Textarea
                    id="vita-comments"
                    value={vitaForm.commentaires}
                    onChange={(e) => setVitaForm(prev => ({ ...prev, commentaires: e.target.value }))}
                    placeholder="Informations complémentaires..."
                    rows={3}
                  />
                </div>

                {/* Document confirmation */}
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="vita-confirm"
                    checked={vitaForm.confirmDocuments}
                    onCheckedChange={(checked) => 
                      setVitaForm(prev => ({ ...prev, confirmDocuments: checked as boolean }))
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor="vita-confirm" className="font-medium cursor-pointer">
                      Je confirme avoir téléchargé tous les documents requis
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Proposition signée, questionnaire de santé, justificatifs, etc.
                    </p>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSubmitVita}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Soumettre le formulaire VITA
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MEDIO Tab */}
          <TabsContent value="medio">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-green-500" />
                  Formulaire MEDIO - Complémentaire Santé
                </CardTitle>
                <CardDescription>
                  Pour les assurances complémentaires
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Client Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="medio-nom">Nom du client *</Label>
                    <Input
                      id="medio-nom"
                      value={medioForm.clientName}
                      onChange={(e) => setMedioForm(prev => ({ ...prev, clientName: e.target.value }))}
                      placeholder="Nom de famille"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="medio-prenom">Prénom du client *</Label>
                    <Input
                      id="medio-prenom"
                      value={medioForm.clientPrenom}
                      onChange={(e) => setMedioForm(prev => ({ ...prev, clientPrenom: e.target.value }))}
                      placeholder="Prénom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="medio-email">Email du client *</Label>
                    <Input
                      id="medio-email"
                      type="email"
                      value={medioForm.clientEmail}
                      onChange={(e) => setMedioForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                      placeholder="email@exemple.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="medio-tel">Téléphone</Label>
                    <Input
                      id="medio-tel"
                      value={medioForm.clientTel}
                      onChange={(e) => setMedioForm(prev => ({ ...prev, clientTel: e.target.value }))}
                      placeholder="+41 79 000 00 00"
                    />
                  </div>
                </div>

                {/* Contract Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="medio-date">Date d'effet</Label>
                    <Input
                      id="medio-date"
                      type="date"
                      value={medioForm.dateEffet}
                      onChange={(e) => setMedioForm(prev => ({ ...prev, dateEffet: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="medio-type">Type de couverture</Label>
                    <Select
                      value={medioForm.typeCouverture}
                      onValueChange={(value) => setMedioForm(prev => ({ ...prev, typeCouverture: value }))}
                    >
                      <SelectTrigger id="medio-type">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ambulatoire">Ambulatoire</SelectItem>
                        <SelectItem value="hospitalisation">Hospitalisation</SelectItem>
                        <SelectItem value="dentaire">Dentaire</SelectItem>
                        <SelectItem value="optique">Optique</SelectItem>
                        <SelectItem value="complet">Complet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="medio-prod">Production (CHF)</Label>
                    <Input
                      id="medio-prod"
                      type="number"
                      value={medioForm.production}
                      onChange={(e) => setMedioForm(prev => ({ ...prev, production: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medio-agent">Nom de l'agent</Label>
                  <Input
                    id="medio-agent"
                    value={medioForm.agentName}
                    onChange={(e) => setMedioForm(prev => ({ ...prev, agentName: e.target.value }))}
                    placeholder="Votre nom"
                  />
                </div>

                {/* Comments */}
                <div className="space-y-2">
                  <Label htmlFor="medio-comments">Commentaires</Label>
                  <Textarea
                    id="medio-comments"
                    value={medioForm.commentaires}
                    onChange={(e) => setMedioForm(prev => ({ ...prev, commentaires: e.target.value }))}
                    placeholder="Informations complémentaires..."
                    rows={3}
                  />
                </div>

                {/* Document confirmation */}
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="medio-confirm"
                    checked={medioForm.confirmDocuments}
                    onCheckedChange={(checked) => 
                      setMedioForm(prev => ({ ...prev, confirmDocuments: checked as boolean }))
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor="medio-confirm" className="font-medium cursor-pointer">
                      Je confirme avoir téléchargé tous les documents requis
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Proposition, questionnaire médical, pièce d'identité, etc.
                    </p>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSubmitMedio}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Soumettre le formulaire MEDIO
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUSINESS Tab */}
          <TabsContent value="business">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-purple-500" />
                  Formulaire BUSINESS - Assurance Entreprise
                </CardTitle>
                <CardDescription>
                  Pour les contrats d'assurance entreprise (RC, LAA, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Company Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Informations de l'entreprise
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="biz-nom">Nom de l'entreprise *</Label>
                      <Input
                        id="biz-nom"
                        value={businessForm.entrepriseNom}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseNom: e.target.value }))}
                        placeholder="Raison sociale"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="biz-activite">Activité</Label>
                      <Input
                        id="biz-activite"
                        value={businessForm.entrepriseActivite}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseActivite: e.target.value }))}
                        placeholder="Secteur d'activité"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="biz-forme">Forme juridique</Label>
                      <Select
                        value={businessForm.formeSociete}
                        onValueChange={(value) => setBusinessForm(prev => ({ ...prev, formeSociete: value }))}
                      >
                        <SelectTrigger id="biz-forme">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sa">SA</SelectItem>
                          <SelectItem value="sarl">Sàrl</SelectItem>
                          <SelectItem value="ri">Raison individuelle</SelectItem>
                          <SelectItem value="snc">SNC</SelectItem>
                          <SelectItem value="association">Association</SelectItem>
                          <SelectItem value="fondation">Fondation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nouvelle création ?</Label>
                      <RadioGroup
                        value={businessForm.nouvelleCreation}
                        onValueChange={(value) => setBusinessForm(prev => ({ ...prev, nouvelleCreation: value }))}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="oui" id="nouvelle-oui" />
                          <Label htmlFor="nouvelle-oui">Oui</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="non" id="nouvelle-non" />
                          <Label htmlFor="nouvelle-non">Non</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="biz-adresse">Adresse de l'entreprise</Label>
                    <Input
                      id="biz-adresse"
                      value={businessForm.entrepriseAdresse}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseAdresse: e.target.value }))}
                      placeholder="Adresse complète"
                    />
                  </div>
                </div>

                {/* CEO Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Chef d'entreprise
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="chef-civilite">Civilité</Label>
                      <Select
                        value={businessForm.civilite}
                        onValueChange={(value) => setBusinessForm(prev => ({ ...prev, civilite: value }))}
                      >
                        <SelectTrigger id="chef-civilite">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="m">Monsieur</SelectItem>
                          <SelectItem value="mme">Madame</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chef-prenom">Prénom *</Label>
                      <Input
                        id="chef-prenom"
                        value={businessForm.chefPrenom}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, chefPrenom: e.target.value }))}
                        placeholder="Prénom"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chef-nom">Nom *</Label>
                      <Input
                        id="chef-nom"
                        value={businessForm.chefNom}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, chefNom: e.target.value }))}
                        placeholder="Nom"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chef-naissance">Date de naissance</Label>
                      <Input
                        id="chef-naissance"
                        type="date"
                        value={businessForm.dateNaissance}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, dateNaissance: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chef-nationalite">Nationalité</Label>
                      <Input
                        id="chef-nationalite"
                        value={businessForm.nationalite}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, nationalite: e.target.value }))}
                        placeholder="Nationalité"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chef-permis">Type de permis</Label>
                      <Select
                        value={businessForm.permis}
                        onValueChange={(value) => setBusinessForm(prev => ({ ...prev, permis: value }))}
                      >
                        <SelectTrigger id="chef-permis">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="suisse">Citoyen Suisse</SelectItem>
                          <SelectItem value="c">Permis C</SelectItem>
                          <SelectItem value="b">Permis B</SelectItem>
                          <SelectItem value="g">Permis G</SelectItem>
                          <SelectItem value="l">Permis L</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Date and Contact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="biz-date-effet">Date d'effet souhaitée</Label>
                    <Input
                      id="biz-date-effet"
                      type="date"
                      value={businessForm.dateEffet}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, dateEffet: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="biz-email">Email de retour</Label>
                    <Input
                      id="biz-email"
                      type="email"
                      value={businessForm.emailRetour}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, emailRetour: e.target.value }))}
                      placeholder="email@entreprise.ch"
                    />
                  </div>
                </div>

                {/* Comments */}
                <div className="space-y-2">
                  <Label htmlFor="biz-comments">Commentaires</Label>
                  <Textarea
                    id="biz-comments"
                    value={businessForm.commentaires}
                    onChange={(e) => setBusinessForm(prev => ({ ...prev, commentaires: e.target.value }))}
                    placeholder="Besoins spécifiques, détails des couvertures souhaitées..."
                    rows={4}
                  />
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSubmitBusiness}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Soumettre le formulaire BUSINESS
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
