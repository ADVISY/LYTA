import { useState, useEffect } from "react";
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
  Mail,
  LogOut,
  FileText,
  AlertCircle
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import DocumentUpload from "@/components/crm/DocumentUpload";
import lytaLogo from "@/assets/lyta-logo.svg";

type UploadedDocument = {
  file_key: string;
  file_name: string;
  doc_kind: string;
  mime_type: string;
  size_bytes: number;
};

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

type FormType = 'sana' | 'vita' | 'medio' | 'business' | null;

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
  dateEffet: string;
  emailRetour: string;
  commentaires: string;
};

const formTypes = [
  {
    id: 'sana' as FormType,
    title: 'SANA',
    subtitle: 'Assurance Maladie',
    description: 'LAMal et LCA',
    icon: Shield,
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'vita' as FormType,
    title: 'VITA',
    subtitle: 'Assurance Vie',
    description: 'Prévoyance et épargne',
    icon: Heart,
    color: 'from-red-500 to-red-600',
  },
  {
    id: 'medio' as FormType,
    title: 'MEDIO',
    subtitle: 'Complémentaire Santé',
    description: 'Couvertures additionnelles',
    icon: FileCheck,
    color: 'from-green-500 to-green-600',
  },
  {
    id: 'business' as FormType,
    title: 'BUSINESS',
    subtitle: 'Assurance Entreprise',
    description: 'RC, LAA et plus',
    icon: Briefcase,
    color: 'from-purple-500 to-purple-600',
  },
];

export default function DeposerContrat() {
  const { celebrate } = useCelebration();
  const { toast } = useToast();

  // Email verification state
  const [verificationStep, setVerificationStep] = useState<'email' | 'selection' | 'form'>('email');
  const [partnerEmail, setPartnerEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifiedPartner, setVerifiedPartner] = useState<VerifiedPartner | null>(null);
  const [selectedFormType, setSelectedFormType] = useState<FormType>(null);

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
    dateEffet: "",
    emailRetour: "",
    commentaires: "",
  });

  // Documents state for each form
  const [sanaDocuments, setSanaDocuments] = useState<UploadedDocument[]>([]);
  const [vitaDocuments, setVitaDocuments] = useState<UploadedDocument[]>([]);
  const [medioDocuments, setMedioDocuments] = useState<UploadedDocument[]>([]);
  const [businessDocuments, setBusinessDocuments] = useState<UploadedDocument[]>([]);

  // Required documents for each form type
  const sanaRequiredDocs = [
    "Pièce d'identité (recto/verso)",
    "Attestation de résidence",
    "Bulletin de salaire (3 derniers mois)",
    "Permis de séjour (si applicable)",
    "Proposition signée",
  ];

  const vitaRequiredDocs = [
    "Pièce d'identité (recto/verso)",
    "Proposition signée",
    "Questionnaire de santé complété",
    "Justificatif de domicile",
    "Dernière déclaration fiscale (optionnel)",
  ];

  const medioRequiredDocs = [
    "Pièce d'identité (recto/verso)",
    "Proposition signée",
    "Questionnaire médical",
    "Attestation d'assurance LAMal actuelle",
  ];

  const businessRequiredDocs = [
    "Extrait du registre du commerce",
    "Statuts de l'entreprise",
    "Pièce d'identité du chef d'entreprise",
    "Bilan des 2 derniers exercices",
    "Liste du personnel avec salaires",
    "Contrat de bail (si locataire)",
  ];

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
        setVerificationStep('selection');
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
    setSelectedFormType(null);
  };

  const handleSelectFormType = (formType: FormType) => {
    setSelectedFormType(formType);
    setVerificationStep('form');
  };

  const handleBackToSelection = () => {
    setSelectedFormType(null);
    setVerificationStep('selection');
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

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const clientName = client.last_name || "";
      const clientPrenom = client.first_name || "";
      const clientEmail = client.email || "";
      const clientTel = client.mobile || client.phone || "";

      setSanaForm(prev => ({ ...prev, clientName, clientPrenom, clientEmail, clientTel }));
      setVitaForm(prev => ({ ...prev, clientName, clientPrenom, clientEmail, clientTel }));
      setMedioForm(prev => ({ ...prev, clientName, clientPrenom, clientEmail, clientTel }));
    }
  };

  const handleSubmitSana = async () => {
    if (!sanaForm.clientName || !sanaForm.clientPrenom || !sanaForm.clientEmail) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    if (!sanaForm.confirmDocuments) {
      toast({ title: "Confirmation requise", description: "Veuillez confirmer avoir téléchargé tous les documents requis", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("policies").insert({
        client_id: selectedClientId || null,
        product_id: "00000000-0000-0000-0000-000000000001",
        start_date: sanaForm.lamalDateEffet || new Date().toISOString().split("T")[0],
        status: "pending",
        notes: `SANA - Agent: ${sanaForm.agentName}\nEmail Agent: ${partnerEmail}\nLAMal Date: ${sanaForm.lamalDateEffet}\nLCA Date: ${sanaForm.lcaDateEffet}\nLCA Production: ${sanaForm.lcaProduction}\n${sanaForm.commentaires}`,
        product_type: "sana",
      });

      if (error) throw error;

      celebrate("contract_added");
      toast({ title: "Formulaire SANA envoyé !", description: "Votre demande a été soumise avec succès" });

      setSanaForm({
        clientName: "", clientPrenom: "", clientEmail: "", clientTel: "",
        lamalDateEffet: "", lcaDateEffet: "", lcaProduction: "",
        agentName: verifiedPartner?.name || "", commentaires: "", confirmDocuments: false,
      });
      setSelectedClientId("");
      handleBackToSelection();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible de soumettre le formulaire", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitVita = async () => {
    if (!vitaForm.clientName || !vitaForm.clientPrenom || !vitaForm.clientEmail) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    if (!vitaForm.confirmDocuments) {
      toast({ title: "Confirmation requise", description: "Veuillez confirmer avoir téléchargé tous les documents requis", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("policies").insert({
        client_id: selectedClientId || null,
        product_id: "00000000-0000-0000-0000-000000000002",
        start_date: vitaForm.vitaDateEffet || new Date().toISOString().split("T")[0],
        premium_monthly: parseFloat(vitaForm.vitaPrimeMensuelle) || 0,
        status: "pending",
        notes: `VITA - Agent: ${vitaForm.agentName}\nEmail Agent: ${partnerEmail}\nDurée: ${vitaForm.vitaDureeContrat}\n${vitaForm.commentaires}`,
        product_type: "vita",
      });

      if (error) throw error;

      celebrate("contract_added");
      toast({ title: "Formulaire VITA envoyé !", description: "Votre demande a été soumise avec succès" });

      setVitaForm({
        clientName: "", clientPrenom: "", clientEmail: "", clientTel: "",
        vitaDateEffet: "", vitaDureeContrat: "", vitaPrimeMensuelle: "",
        agentName: verifiedPartner?.name || "", commentaires: "", confirmDocuments: false,
      });
      setSelectedClientId("");
      handleBackToSelection();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible de soumettre le formulaire", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMedio = async () => {
    if (!medioForm.clientName || !medioForm.clientPrenom || !medioForm.clientEmail) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    if (!medioForm.confirmDocuments) {
      toast({ title: "Confirmation requise", description: "Veuillez confirmer avoir téléchargé tous les documents requis", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("policies").insert({
        client_id: selectedClientId || null,
        product_id: "00000000-0000-0000-0000-000000000003",
        start_date: medioForm.dateEffet || new Date().toISOString().split("T")[0],
        status: "pending",
        notes: `MEDIO - Agent: ${medioForm.agentName}\nEmail Agent: ${partnerEmail}\nType: ${medioForm.typeCouverture}\nProduction: ${medioForm.production}\n${medioForm.commentaires}`,
        product_type: "medio",
      });

      if (error) throw error;

      celebrate("contract_added");
      toast({ title: "Formulaire MEDIO envoyé !", description: "Votre demande a été soumise avec succès" });

      setMedioForm({
        clientName: "", clientPrenom: "", clientEmail: "", clientTel: "",
        dateEffet: "", typeCouverture: "", production: "",
        agentName: verifiedPartner?.name || "", commentaires: "", confirmDocuments: false,
      });
      setSelectedClientId("");
      handleBackToSelection();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible de soumettre le formulaire", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBusiness = async () => {
    if (!businessForm.entrepriseNom || !businessForm.chefPrenom || !businessForm.chefNom) {
      toast({ title: "Erreur", description: "Veuillez remplir les informations de l'entreprise et du chef d'entreprise", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("policies").insert({
        client_id: selectedClientId || null,
        product_id: "00000000-0000-0000-0000-000000000004",
        start_date: businessForm.dateEffet || new Date().toISOString().split("T")[0],
        status: "pending",
        notes: `BUSINESS - Email Agent: ${partnerEmail}\nEntreprise: ${businessForm.entrepriseNom}\nChef: ${businessForm.chefPrenom} ${businessForm.chefNom}\nActivité: ${businessForm.entrepriseActivite}\n${businessForm.commentaires}`,
        product_type: "business",
        products_data: businessForm,
      });

      if (error) throw error;

      celebrate("contract_added");
      toast({ title: "Formulaire BUSINESS envoyé !", description: "Votre demande a été soumise avec succès" });

      setBusinessForm({
        entrepriseNom: "", entrepriseActivite: "", formeSociete: "", nouvelleCreation: "",
        entrepriseAdresse: "", chefPrenom: "", chefNom: "", civilite: "", dateNaissance: "",
        chefAdresse: "", nationalite: "", permis: "", dateEffet: "", emailRetour: "", commentaires: "",
      });
      setSelectedClientId("");
      handleBackToSelection();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible de soumettre le formulaire", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Email verification screen
  if (verificationStep === 'email') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between">
            <img src={lytaLogo} alt="LYTA" className="h-8" />
            <ThemeToggle />
          </div>
        </header>

        <main className="container py-16 max-w-md">
          <Card className="border-2">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-king/10 rounded-full flex items-center justify-center">
                <Mail className="h-8 w-8 text-king" />
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
                  onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyEmail(); }}
                  disabled={verifying}
                />
              </div>
              <Button 
                className="w-full bg-king hover:bg-king-dark text-white" 
                onClick={handleVerifyEmail}
                disabled={verifying}
              >
                {verifying ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Vérification...</>
                ) : (
                  <><Check className="mr-2 h-4 w-4" />Vérifier mon accès</>
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

  // Form selection screen
  if (verificationStep === 'selection') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between">
            <img src={lytaLogo} alt="LYTA" className="h-8" />
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-king/10 rounded-full">
                <User className="h-4 w-4 text-king" />
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

        <main className="container py-12 max-w-4xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight">Formulaire de production LYTA</h1>
            <p className="text-muted-foreground mt-2">Sélectionnez le type de contrat à déposer</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {formTypes.map((form) => {
              const Icon = form.icon;
              return (
                <button
                  key={form.id}
                  onClick={() => handleSelectFormType(form.id)}
                  className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card p-6 text-left transition-all hover:border-king hover:shadow-lg hover:shadow-king/10 focus:outline-none focus:ring-2 focus:ring-king focus:ring-offset-2"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${form.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                  <div className="relative">
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${form.color} mb-4`}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold">{form.title}</h3>
                    <p className="text-base font-medium text-king mt-1">{form.subtitle}</p>
                    <p className="text-sm text-muted-foreground mt-2">{form.description}</p>
                  </div>
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowLeft className="h-5 w-5 text-king rotate-180" />
                  </div>
                </button>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-king" />
      </div>
    );
  }

  // Get current form config
  const currentForm = formTypes.find(f => f.id === selectedFormType);
  const CurrentIcon = currentForm?.icon || Shield;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackToSelection}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={lytaLogo} alt="LYTA" className="h-8" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-king/10 rounded-full">
              <User className="h-4 w-4 text-king" />
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

      <main className="container py-8 max-w-3xl">
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
                <div className="flex items-center gap-2 px-3 py-2 bg-king/10 rounded-lg">
                  <Check className="h-4 w-4 text-king" />
                  <span className="text-sm font-medium">{getClientName(selectedClient)}</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedClientId("")} className="h-6 w-6 p-0">×</Button>
                </div>
              )}
            </div>
            {clientSearch && !selectedClientId && (
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                {filteredClients.slice(0, 10).map((client) => (
                  <button
                    key={client.id}
                    onClick={() => { handleClientSelect(client.id); setClientSearch(""); }}
                    className="w-full p-3 text-left hover:bg-muted transition-colors border-b last:border-b-0"
                  >
                    <p className="font-medium">{getClientName(client)}</p>
                    {client.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
                  </button>
                ))}
                {filteredClients.length === 0 && <p className="p-3 text-center text-muted-foreground">Aucun client trouvé</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SANA Form */}
        {selectedFormType === 'sana' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                Formulaire SANA - Assurance Maladie
              </CardTitle>
              <CardDescription>Pour les contrats LAMal et LCA</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du client *</Label>
                  <Input value={sanaForm.clientName} onChange={(e) => setSanaForm(prev => ({ ...prev, clientName: e.target.value }))} placeholder="Nom de famille" />
                </div>
                <div className="space-y-2">
                  <Label>Prénom du client *</Label>
                  <Input value={sanaForm.clientPrenom} onChange={(e) => setSanaForm(prev => ({ ...prev, clientPrenom: e.target.value }))} placeholder="Prénom" />
                </div>
                <div className="space-y-2">
                  <Label>Email du client *</Label>
                  <Input type="email" value={sanaForm.clientEmail} onChange={(e) => setSanaForm(prev => ({ ...prev, clientEmail: e.target.value }))} placeholder="email@exemple.com" />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={sanaForm.clientTel} onChange={(e) => setSanaForm(prev => ({ ...prev, clientTel: e.target.value }))} placeholder="+41 79 000 00 00" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date d'effet LAMal</Label>
                  <Input type="date" value={sanaForm.lamalDateEffet} onChange={(e) => setSanaForm(prev => ({ ...prev, lamalDateEffet: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Date d'effet LCA</Label>
                  <Input type="date" value={sanaForm.lcaDateEffet} onChange={(e) => setSanaForm(prev => ({ ...prev, lcaDateEffet: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Production LCA (CHF)</Label>
                  <Input type="number" value={sanaForm.lcaProduction} onChange={(e) => setSanaForm(prev => ({ ...prev, lcaProduction: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Nom de l'agent</Label>
                  <Input value={sanaForm.agentName} onChange={(e) => setSanaForm(prev => ({ ...prev, agentName: e.target.value }))} placeholder="Votre nom" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Commentaires</Label>
                <Textarea value={sanaForm.commentaires} onChange={(e) => setSanaForm(prev => ({ ...prev, commentaires: e.target.value }))} placeholder="Informations complémentaires..." rows={3} />
              </div>

              {/* Documents Section */}
              <div className="space-y-4 p-4 border-2 border-dashed border-king/30 rounded-lg bg-king/5">
                <div className="flex items-center gap-2 text-king">
                  <FileText className="h-5 w-5" />
                  <h3 className="font-semibold">Documents à fournir</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {sanaRequiredDocs.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{doc}</span>
                    </div>
                  ))}
                </div>
                <DocumentUpload
                  onUpload={(doc) => setSanaDocuments(prev => [...prev, doc])}
                  onRemove={(index) => setSanaDocuments(prev => prev.filter((_, i) => i !== index))}
                  documents={sanaDocuments}
                />
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Checkbox id="sana-confirm" checked={sanaForm.confirmDocuments} onCheckedChange={(checked) => setSanaForm(prev => ({ ...prev, confirmDocuments: checked as boolean }))} />
                <div className="space-y-1">
                  <Label htmlFor="sana-confirm" className="font-medium cursor-pointer">Je confirme avoir téléchargé tous les documents requis</Label>
                  <p className="text-sm text-muted-foreground">Vous avez ajouté {sanaDocuments.length} document(s)</p>
                </div>
              </div>
              <Button className="w-full bg-king hover:bg-king-dark text-white" size="lg" onClick={handleSubmitSana} disabled={submitting || sanaDocuments.length === 0}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours...</> : <><Upload className="mr-2 h-4 w-4" />Soumettre le formulaire SANA</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* VITA Form */}
        {selectedFormType === 'vita' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600">
                  <Heart className="h-5 w-5 text-white" />
                </div>
                Formulaire VITA - Assurance Vie
              </CardTitle>
              <CardDescription>Pour les contrats d'assurance vie</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du client *</Label>
                  <Input value={vitaForm.clientName} onChange={(e) => setVitaForm(prev => ({ ...prev, clientName: e.target.value }))} placeholder="Nom de famille" />
                </div>
                <div className="space-y-2">
                  <Label>Prénom du client *</Label>
                  <Input value={vitaForm.clientPrenom} onChange={(e) => setVitaForm(prev => ({ ...prev, clientPrenom: e.target.value }))} placeholder="Prénom" />
                </div>
                <div className="space-y-2">
                  <Label>Email du client *</Label>
                  <Input type="email" value={vitaForm.clientEmail} onChange={(e) => setVitaForm(prev => ({ ...prev, clientEmail: e.target.value }))} placeholder="email@exemple.com" />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={vitaForm.clientTel} onChange={(e) => setVitaForm(prev => ({ ...prev, clientTel: e.target.value }))} placeholder="+41 79 000 00 00" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date d'effet</Label>
                  <Input type="date" value={vitaForm.vitaDateEffet} onChange={(e) => setVitaForm(prev => ({ ...prev, vitaDateEffet: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Durée du contrat</Label>
                  <Select value={vitaForm.vitaDureeContrat} onValueChange={(value) => setVitaForm(prev => ({ ...prev, vitaDureeContrat: value }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
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
                  <Label>Prime mensuelle (CHF)</Label>
                  <Input type="number" value={vitaForm.vitaPrimeMensuelle} onChange={(e) => setVitaForm(prev => ({ ...prev, vitaPrimeMensuelle: e.target.value }))} placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nom de l'agent</Label>
                <Input value={vitaForm.agentName} onChange={(e) => setVitaForm(prev => ({ ...prev, agentName: e.target.value }))} placeholder="Votre nom" />
              </div>
              <div className="space-y-2">
                <Label>Commentaires</Label>
                <Textarea value={vitaForm.commentaires} onChange={(e) => setVitaForm(prev => ({ ...prev, commentaires: e.target.value }))} placeholder="Informations complémentaires..." rows={3} />
              </div>

              {/* Documents Section */}
              <div className="space-y-4 p-4 border-2 border-dashed border-king/30 rounded-lg bg-king/5">
                <div className="flex items-center gap-2 text-king">
                  <FileText className="h-5 w-5" />
                  <h3 className="font-semibold">Documents à fournir</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {vitaRequiredDocs.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{doc}</span>
                    </div>
                  ))}
                </div>
                <DocumentUpload
                  onUpload={(doc) => setVitaDocuments(prev => [...prev, doc])}
                  onRemove={(index) => setVitaDocuments(prev => prev.filter((_, i) => i !== index))}
                  documents={vitaDocuments}
                />
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Checkbox id="vita-confirm" checked={vitaForm.confirmDocuments} onCheckedChange={(checked) => setVitaForm(prev => ({ ...prev, confirmDocuments: checked as boolean }))} />
                <div className="space-y-1">
                  <Label htmlFor="vita-confirm" className="font-medium cursor-pointer">Je confirme avoir téléchargé tous les documents requis</Label>
                  <p className="text-sm text-muted-foreground">Vous avez ajouté {vitaDocuments.length} document(s)</p>
                </div>
              </div>
              <Button className="w-full bg-king hover:bg-king-dark text-white" size="lg" onClick={handleSubmitVita} disabled={submitting || vitaDocuments.length === 0}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours...</> : <><Upload className="mr-2 h-4 w-4" />Soumettre le formulaire VITA</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* MEDIO Form */}
        {selectedFormType === 'medio' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600">
                  <FileCheck className="h-5 w-5 text-white" />
                </div>
                Formulaire MEDIO - Complémentaire Santé
              </CardTitle>
              <CardDescription>Pour les assurances complémentaires</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom du client *</Label>
                  <Input value={medioForm.clientName} onChange={(e) => setMedioForm(prev => ({ ...prev, clientName: e.target.value }))} placeholder="Nom de famille" />
                </div>
                <div className="space-y-2">
                  <Label>Prénom du client *</Label>
                  <Input value={medioForm.clientPrenom} onChange={(e) => setMedioForm(prev => ({ ...prev, clientPrenom: e.target.value }))} placeholder="Prénom" />
                </div>
                <div className="space-y-2">
                  <Label>Email du client *</Label>
                  <Input type="email" value={medioForm.clientEmail} onChange={(e) => setMedioForm(prev => ({ ...prev, clientEmail: e.target.value }))} placeholder="email@exemple.com" />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={medioForm.clientTel} onChange={(e) => setMedioForm(prev => ({ ...prev, clientTel: e.target.value }))} placeholder="+41 79 000 00 00" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date d'effet</Label>
                  <Input type="date" value={medioForm.dateEffet} onChange={(e) => setMedioForm(prev => ({ ...prev, dateEffet: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Type de couverture</Label>
                  <Select value={medioForm.typeCouverture} onValueChange={(value) => setMedioForm(prev => ({ ...prev, typeCouverture: value }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
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
                  <Label>Production (CHF)</Label>
                  <Input type="number" value={medioForm.production} onChange={(e) => setMedioForm(prev => ({ ...prev, production: e.target.value }))} placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nom de l'agent</Label>
                <Input value={medioForm.agentName} onChange={(e) => setMedioForm(prev => ({ ...prev, agentName: e.target.value }))} placeholder="Votre nom" />
              </div>
              <div className="space-y-2">
                <Label>Commentaires</Label>
                <Textarea value={medioForm.commentaires} onChange={(e) => setMedioForm(prev => ({ ...prev, commentaires: e.target.value }))} placeholder="Informations complémentaires..." rows={3} />
              </div>

              {/* Documents Section */}
              <div className="space-y-4 p-4 border-2 border-dashed border-king/30 rounded-lg bg-king/5">
                <div className="flex items-center gap-2 text-king">
                  <FileText className="h-5 w-5" />
                  <h3 className="font-semibold">Documents à fournir</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {medioRequiredDocs.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{doc}</span>
                    </div>
                  ))}
                </div>
                <DocumentUpload
                  onUpload={(doc) => setMedioDocuments(prev => [...prev, doc])}
                  onRemove={(index) => setMedioDocuments(prev => prev.filter((_, i) => i !== index))}
                  documents={medioDocuments}
                />
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Checkbox id="medio-confirm" checked={medioForm.confirmDocuments} onCheckedChange={(checked) => setMedioForm(prev => ({ ...prev, confirmDocuments: checked as boolean }))} />
                <div className="space-y-1">
                  <Label htmlFor="medio-confirm" className="font-medium cursor-pointer">Je confirme avoir téléchargé tous les documents requis</Label>
                  <p className="text-sm text-muted-foreground">Vous avez ajouté {medioDocuments.length} document(s)</p>
                </div>
              </div>
              <Button className="w-full bg-king hover:bg-king-dark text-white" size="lg" onClick={handleSubmitMedio} disabled={submitting || medioDocuments.length === 0}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours...</> : <><Upload className="mr-2 h-4 w-4" />Soumettre le formulaire MEDIO</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* BUSINESS Form */}
        {selectedFormType === 'business' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                Formulaire BUSINESS - Assurance Entreprise
              </CardTitle>
              <CardDescription>Pour les contrats d'assurance entreprise (RC, LAA, etc.)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" />Informations de l'entreprise</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom de l'entreprise *</Label>
                    <Input value={businessForm.entrepriseNom} onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseNom: e.target.value }))} placeholder="Raison sociale" />
                  </div>
                  <div className="space-y-2">
                    <Label>Activité</Label>
                    <Input value={businessForm.entrepriseActivite} onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseActivite: e.target.value }))} placeholder="Secteur d'activité" />
                  </div>
                  <div className="space-y-2">
                    <Label>Forme juridique</Label>
                    <Select value={businessForm.formeSociete} onValueChange={(value) => setBusinessForm(prev => ({ ...prev, formeSociete: value }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
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
                    <RadioGroup value={businessForm.nouvelleCreation} onValueChange={(value) => setBusinessForm(prev => ({ ...prev, nouvelleCreation: value }))} className="flex gap-4 pt-2">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="oui" id="nouvelle-oui" /><Label htmlFor="nouvelle-oui">Oui</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="non" id="nouvelle-non" /><Label htmlFor="nouvelle-non">Non</Label></div>
                    </RadioGroup>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Adresse de l'entreprise</Label>
                  <Input value={businessForm.entrepriseAdresse} onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseAdresse: e.target.value }))} placeholder="Adresse complète" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><User className="h-4 w-4" />Chef d'entreprise</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Civilité</Label>
                    <Select value={businessForm.civilite} onValueChange={(value) => setBusinessForm(prev => ({ ...prev, civilite: value }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="m">Monsieur</SelectItem>
                        <SelectItem value="mme">Madame</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input value={businessForm.chefPrenom} onChange={(e) => setBusinessForm(prev => ({ ...prev, chefPrenom: e.target.value }))} placeholder="Prénom" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input value={businessForm.chefNom} onChange={(e) => setBusinessForm(prev => ({ ...prev, chefNom: e.target.value }))} placeholder="Nom" />
                  </div>
                  <div className="space-y-2">
                    <Label>Date de naissance</Label>
                    <Input type="date" value={businessForm.dateNaissance} onChange={(e) => setBusinessForm(prev => ({ ...prev, dateNaissance: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nationalité</Label>
                    <Input value={businessForm.nationalite} onChange={(e) => setBusinessForm(prev => ({ ...prev, nationalite: e.target.value }))} placeholder="Nationalité" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type de permis</Label>
                    <Select value={businessForm.permis} onValueChange={(value) => setBusinessForm(prev => ({ ...prev, permis: value }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date d'effet souhaitée</Label>
                  <Input type="date" value={businessForm.dateEffet} onChange={(e) => setBusinessForm(prev => ({ ...prev, dateEffet: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email de retour</Label>
                  <Input type="email" value={businessForm.emailRetour} onChange={(e) => setBusinessForm(prev => ({ ...prev, emailRetour: e.target.value }))} placeholder="email@entreprise.ch" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Commentaires</Label>
                <Textarea value={businessForm.commentaires} onChange={(e) => setBusinessForm(prev => ({ ...prev, commentaires: e.target.value }))} placeholder="Besoins spécifiques, détails des couvertures souhaitées..." rows={4} />
              </div>

              {/* Documents Section */}
              <div className="space-y-4 p-4 border-2 border-dashed border-king/30 rounded-lg bg-king/5">
                <div className="flex items-center gap-2 text-king">
                  <FileText className="h-5 w-5" />
                  <h3 className="font-semibold">Documents à fournir</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {businessRequiredDocs.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{doc}</span>
                    </div>
                  ))}
                </div>
                <DocumentUpload
                  onUpload={(doc) => setBusinessDocuments(prev => [...prev, doc])}
                  onRemove={(index) => setBusinessDocuments(prev => prev.filter((_, i) => i !== index))}
                  documents={businessDocuments}
                />
              </div>

              <Button className="w-full bg-king hover:bg-king-dark text-white" size="lg" onClick={handleSubmitBusiness} disabled={submitting || businessDocuments.length === 0}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours...</> : <><Upload className="mr-2 h-4 w-4" />Soumettre le formulaire BUSINESS</>}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
