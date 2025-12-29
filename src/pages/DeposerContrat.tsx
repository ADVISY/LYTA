import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  AlertCircle
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
  const { user, loading: authLoading } = useAuth();
  const { celebrate } = useCelebration();
  const { toast } = useToast();

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

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('loginTarget', 'team');
      navigate("/connexion");
    }
  }, [user, authLoading, navigate]);

  // Load clients
  useEffect(() => {
    if (user) {
      loadClients();
    }
  }, [user]);

  const loadClients = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clients")
      .select("id, first_name, last_name, company_name, email, phone, mobile")
      .order("last_name");
    if (data) setClients(data);
    setLoading(false);
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
        notes: `SANA - Agent: ${sanaForm.agentName}\nLAMal Date: ${sanaForm.lamalDateEffet}\nLCA Date: ${sanaForm.lcaDateEffet}\nLCA Production: ${sanaForm.lcaProduction}\n${sanaForm.commentaires}`,
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
        agentName: "",
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
        notes: `VITA - Agent: ${vitaForm.agentName}\nDurée: ${vitaForm.vitaDureeContrat}\n${vitaForm.commentaires}`,
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
        agentName: "",
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
        notes: `MEDIO - Agent: ${medioForm.agentName}\nType: ${medioForm.typeCouverture}\nProduction: ${medioForm.production}\n${medioForm.commentaires}`,
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
        agentName: "",
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
    if (!businessForm.entrepriseNom || !businessForm.chefNom || !businessForm.chefPrenom) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
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
        notes: `BUSINESS - Entreprise: ${businessForm.entrepriseNom}\nActivité: ${businessForm.entrepriseActivite}\nForme: ${businessForm.formeSociete}\nChef: ${businessForm.chefPrenom} ${businessForm.chefNom}\n${businessForm.commentaires}`,
        product_type: "business",
        company_name: businessForm.entrepriseNom,
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

  if (authLoading || loading) {
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
            <Button variant="ghost" size="icon" onClick={() => navigate("/connexion")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={lytaLogo} alt="LYTA" className="h-8" />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={() => navigate("/crm")}>
              Accéder au CRM
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

        {/* Form Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="sana" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              SANA
            </TabsTrigger>
            <TabsTrigger value="vita" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              VITA
            </TabsTrigger>
            <TabsTrigger value="medio" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              MEDIO
            </TabsTrigger>
            <TabsTrigger value="business" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              BUSINESS
            </TabsTrigger>
          </TabsList>

          {/* SANA Tab */}
          <TabsContent value="sana">
            <Card>
              <CardHeader className="bg-gradient-to-r from-rose-500/10 to-pink-500/10 rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-rose-500" />
                  Formulaire de production LYTA - SANA
                </CardTitle>
                <CardDescription>Assurance maladie LAMal / LCA</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Client Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input
                      placeholder="Nom du client"
                      value={sanaForm.clientName}
                      onChange={(e) => setSanaForm(prev => ({ ...prev, clientName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input
                      placeholder="Prénom du client"
                      value={sanaForm.clientPrenom}
                      onChange={(e) => setSanaForm(prev => ({ ...prev, clientPrenom: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      placeholder="Email du client"
                      value={sanaForm.clientEmail}
                      onChange={(e) => setSanaForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone *</Label>
                    <Input
                      placeholder="N° de téléphone"
                      value={sanaForm.clientTel}
                      onChange={(e) => setSanaForm(prev => ({ ...prev, clientTel: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Contract Info */}
                <div className="space-y-2">
                  <Label>LAMal - Date d'effet</Label>
                  <Input
                    type="date"
                    value={sanaForm.lamalDateEffet}
                    onChange={(e) => setSanaForm(prev => ({ ...prev, lamalDateEffet: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>LCA - Date d'effet</Label>
                  <Input
                    type="date"
                    value={sanaForm.lcaDateEffet}
                    onChange={(e) => setSanaForm(prev => ({ ...prev, lcaDateEffet: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>LCA - Production (SANA)</Label>
                  <Input
                    placeholder="Montant de la production"
                    value={sanaForm.lcaProduction}
                    onChange={(e) => setSanaForm(prev => ({ ...prev, lcaProduction: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nom de l'agent LYTA *</Label>
                  <Input
                    placeholder="Votre nom complet"
                    value={sanaForm.agentName}
                    onChange={(e) => setSanaForm(prev => ({ ...prev, agentName: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Commentaires</Label>
                  <Textarea
                    placeholder="Pour les familles, en cas de différence sur les dates, utilisez cet espace..."
                    value={sanaForm.commentaires}
                    onChange={(e) => setSanaForm(prev => ({ ...prev, commentaires: e.target.value }))}
                    rows={3}
                  />
                </div>

                {/* Documents Info */}
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                        Vous pouvez ajouter plusieurs documents, merci de les regrouper PAR PERSONNE
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-amber-700 dark:text-amber-300">
                        <li>Proposition avec déclaration de santé</li>
                        <li>Copie des anciennes polices (sauf en cas d'augmentation des couvertures)</li>
                        <li>Copie ou photo des pièces d'identité</li>
                        <li>Documents de résiliations (LAMal & LCA)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="confirm-sana"
                    checked={sanaForm.confirmDocuments}
                    onCheckedChange={(checked) => setSanaForm(prev => ({ ...prev, confirmDocuments: checked as boolean }))}
                  />
                  <label htmlFor="confirm-sana" className="text-sm font-medium cursor-pointer">
                    Je confirme avoir téléchargé tous les documents requis
                  </label>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmitSana}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4 mr-2" />
                      Soumettre SANA
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VITA Tab */}
          <TabsContent value="vita">
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-500" />
                  Formulaire de production LYTA - VITA
                </CardTitle>
                <CardDescription>Assurance vie / Prévoyance / 3e pilier</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Client Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input
                      placeholder="Nom du client"
                      value={vitaForm.clientName}
                      onChange={(e) => setVitaForm(prev => ({ ...prev, clientName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input
                      placeholder="Prénom du client"
                      value={vitaForm.clientPrenom}
                      onChange={(e) => setVitaForm(prev => ({ ...prev, clientPrenom: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      placeholder="Email du client"
                      value={vitaForm.clientEmail}
                      onChange={(e) => setVitaForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone *</Label>
                    <Input
                      placeholder="N° de téléphone"
                      value={vitaForm.clientTel}
                      onChange={(e) => setVitaForm(prev => ({ ...prev, clientTel: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Contract Info */}
                <div className="space-y-2">
                  <Label>Vita - Date d'effet</Label>
                  <Input
                    type="date"
                    value={vitaForm.vitaDateEffet}
                    onChange={(e) => setVitaForm(prev => ({ ...prev, vitaDateEffet: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Vita - Durée du contrat</Label>
                  <Select 
                    value={vitaForm.vitaDureeContrat} 
                    onValueChange={(v) => setVitaForm(prev => ({ ...prev, vitaDureeContrat: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner la durée" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 ans</SelectItem>
                      <SelectItem value="10">10 ans</SelectItem>
                      <SelectItem value="15">15 ans</SelectItem>
                      <SelectItem value="20">20 ans</SelectItem>
                      <SelectItem value="25">25 ans</SelectItem>
                      <SelectItem value="30">30 ans</SelectItem>
                      <SelectItem value="retraite">Jusqu'à la retraite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Vita - Prime mensuelle nette (diviser par 12 si annuelle)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={vitaForm.vitaPrimeMensuelle}
                    onChange={(e) => setVitaForm(prev => ({ ...prev, vitaPrimeMensuelle: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nom de l'agent LYTA *</Label>
                  <Input
                    placeholder="Votre nom complet"
                    value={vitaForm.agentName}
                    onChange={(e) => setVitaForm(prev => ({ ...prev, agentName: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Commentaires</Label>
                  <Textarea
                    placeholder="Informations supplémentaires..."
                    value={vitaForm.commentaires}
                    onChange={(e) => setVitaForm(prev => ({ ...prev, commentaires: e.target.value }))}
                    rows={3}
                  />
                </div>

                {/* Documents Info */}
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Documents requis pour VITA
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-blue-700 dark:text-blue-300">
                        <li>Proposition avec déclaration de santé</li>
                        <li>Copie ou photo des pièces d'identité (certifiées)</li>
                        <li>Formulaire d'adéquation</li>
                        <li>Formulaire débit direct</li>
                        <li>Procès-verbal de conseil (VITA)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="confirm-vita"
                    checked={vitaForm.confirmDocuments}
                    onCheckedChange={(checked) => setVitaForm(prev => ({ ...prev, confirmDocuments: checked as boolean }))}
                  />
                  <label htmlFor="confirm-vita" className="text-sm font-medium cursor-pointer">
                    Je confirme avoir téléchargé tous les documents requis
                  </label>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmitVita}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4 mr-2" />
                      Soumettre VITA
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MEDIO Tab */}
          <TabsContent value="medio">
            <Card>
              <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-emerald-500" />
                  Formulaire de production LYTA - MEDIO
                </CardTitle>
                <CardDescription>Assurances complémentaires (Non-vie)</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Client Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input
                      placeholder="Nom du client"
                      value={medioForm.clientName}
                      onChange={(e) => setMedioForm(prev => ({ ...prev, clientName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input
                      placeholder="Prénom du client"
                      value={medioForm.clientPrenom}
                      onChange={(e) => setMedioForm(prev => ({ ...prev, clientPrenom: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      placeholder="Email du client"
                      value={medioForm.clientEmail}
                      onChange={(e) => setMedioForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone *</Label>
                    <Input
                      placeholder="N° de téléphone"
                      value={medioForm.clientTel}
                      onChange={(e) => setMedioForm(prev => ({ ...prev, clientTel: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Contract Info */}
                <div className="space-y-2">
                  <Label>Date d'effet</Label>
                  <Input
                    type="date"
                    value={medioForm.dateEffet}
                    onChange={(e) => setMedioForm(prev => ({ ...prev, dateEffet: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Type de couverture</Label>
                  <Select 
                    value={medioForm.typeCouverture} 
                    onValueChange={(v) => setMedioForm(prev => ({ ...prev, typeCouverture: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner le type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="menage">Ménage / RC</SelectItem>
                      <SelectItem value="juridique">Protection juridique</SelectItem>
                      <SelectItem value="voyage">Assurance voyage</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Production</Label>
                  <Input
                    placeholder="Montant de la production"
                    value={medioForm.production}
                    onChange={(e) => setMedioForm(prev => ({ ...prev, production: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nom de l'agent LYTA *</Label>
                  <Input
                    placeholder="Votre nom complet"
                    value={medioForm.agentName}
                    onChange={(e) => setMedioForm(prev => ({ ...prev, agentName: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Commentaires</Label>
                  <Textarea
                    placeholder="Informations supplémentaires..."
                    value={medioForm.commentaires}
                    onChange={(e) => setMedioForm(prev => ({ ...prev, commentaires: e.target.value }))}
                    rows={3}
                  />
                </div>

                {/* Documents Info */}
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-emerald-800 dark:text-emerald-200 mb-2">
                        Documents requis pour MEDIO
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-emerald-700 dark:text-emerald-300">
                        <li>Proposition signée</li>
                        <li>Copie des anciennes polices</li>
                        <li>Pièce d'identité</li>
                        <li>Documents de résiliation</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="confirm-medio"
                    checked={medioForm.confirmDocuments}
                    onCheckedChange={(checked) => setMedioForm(prev => ({ ...prev, confirmDocuments: checked as boolean }))}
                  />
                  <label htmlFor="confirm-medio" className="text-sm font-medium cursor-pointer">
                    Je confirme avoir téléchargé tous les documents requis
                  </label>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmitMedio}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4 mr-2" />
                      Soumettre MEDIO
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUSINESS Tab */}
          <TabsContent value="business">
            <Card>
              <CardHeader className="bg-gradient-to-r from-purple-500/10 to-violet-500/10 rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-purple-500" />
                  Formulaire complet Entreprise
                </CardTitle>
                <CardDescription>Assurances PME / Entreprises</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">
                {/* Renseignements généraux */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400">Renseignements généraux</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom de l'entreprise *</Label>
                      <Input
                        placeholder="Nom de l'entreprise"
                        value={businessForm.entrepriseNom}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseNom: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Activité de l'entreprise *</Label>
                      <Input
                        placeholder="Activité"
                        value={businessForm.entrepriseActivite}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseActivite: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Forme de la Société *</Label>
                      <RadioGroup 
                        value={businessForm.formeSociete} 
                        onValueChange={(v) => setBusinessForm(prev => ({ ...prev, formeSociete: v }))}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="sa" id="sa" />
                          <label htmlFor="sa">SA</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="sarl" id="sarl" />
                          <label htmlFor="sarl">Sàrl</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="snc" id="snc" />
                          <label htmlFor="snc">Société en Nom Collectif</label>
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="space-y-2">
                      <Label>Nouvelle création ? *</Label>
                      <RadioGroup 
                        value={businessForm.nouvelleCreation} 
                        onValueChange={(v) => setBusinessForm(prev => ({ ...prev, nouvelleCreation: v }))}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="oui" id="nc-oui" />
                          <label htmlFor="nc-oui">Oui</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="non" id="nc-non" />
                          <label htmlFor="nc-non">Non</label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Adresse de l'entreprise *</Label>
                    <Textarea
                      placeholder="Adresse complète"
                      value={businessForm.entrepriseAdresse}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseAdresse: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Prénom du Chef d'Entreprise *</Label>
                      <Input
                        placeholder="Prénom"
                        value={businessForm.chefPrenom}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, chefPrenom: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nom du Chef d'Entreprise *</Label>
                      <Input
                        placeholder="Nom"
                        value={businessForm.chefNom}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, chefNom: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Civilité *</Label>
                      <Select 
                        value={businessForm.civilite} 
                        onValueChange={(v) => setBusinessForm(prev => ({ ...prev, civilite: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="madame">Madame</SelectItem>
                          <SelectItem value="monsieur">Monsieur</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date de naissance</Label>
                      <Input
                        type="date"
                        value={businessForm.dateNaissance}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, dateNaissance: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Adresse du Chef d'Entreprise *</Label>
                    <Textarea
                      placeholder="Adresse complète"
                      value={businessForm.chefAdresse}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, chefAdresse: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nationalité *</Label>
                      <Input
                        placeholder="Nationalité"
                        value={businessForm.nationalite}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, nationalite: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Permis de séjour *</Label>
                      <Input
                        placeholder="Type de permis"
                        value={businessForm.permis}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, permis: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Responsabilité Civile */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400">Responsabilité Civile</h3>
                  
                  <div className="space-y-2">
                    <Label>Souhaitez-vous une offre responsabilité civile ? *</Label>
                    <RadioGroup 
                      value={businessForm.offreRC} 
                      onValueChange={(v) => setBusinessForm(prev => ({ ...prev, offreRC: v }))}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="oui" id="rc-oui" />
                          <label htmlFor="rc-oui">Oui</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="non" id="rc-non" />
                          <label htmlFor="rc-non">Non</label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  {businessForm.offreRC === "oui" && (
                    <>
                      <div className="space-y-2">
                        <Label>Quel type de contrat RC souhaitez-vous ? *</Label>
                        <RadioGroup 
                          value={businessForm.typeContratRC} 
                          onValueChange={(v) => setBusinessForm(prev => ({ ...prev, typeContratRC: v }))}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="base" id="rc-base" />
                            <label htmlFor="rc-base">RC De Base (Bureau)</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="specifique" id="rc-spec" />
                            <label htmlFor="rc-spec">RC Spécifique À L'activité</label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Chiffre d'Affaire *</Label>
                          <Input
                            placeholder="CHF"
                            value={businessForm.chiffreAffaire}
                            onChange={(e) => setBusinessForm(prev => ({ ...prev, chiffreAffaire: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Somme d'Assurance</Label>
                          <Select 
                            value={businessForm.sommeAssuranceRC} 
                            onValueChange={(v) => setBusinessForm(prev => ({ ...prev, sommeAssuranceRC: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3mio">3 Mio.</SelectItem>
                              <SelectItem value="5mio">5 Mio.</SelectItem>
                              <SelectItem value="10mio">10 Mio.</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Franchise</Label>
                        <Select 
                          value={businessForm.franchiseRC} 
                          onValueChange={(v) => setBusinessForm(prev => ({ ...prev, franchiseRC: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0.--</SelectItem>
                            <SelectItem value="200">200.--</SelectItem>
                            <SelectItem value="500">500.--</SelectItem>
                            <SelectItem value="1000">1000.--</SelectItem>
                            <SelectItem value="2000">2000.--</SelectItem>
                            <SelectItem value="5000">5000.--</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>

                {/* Assurance choses entreprise */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400">Assurance choses entreprise</h3>
                  
                  <div className="space-y-2">
                    <Label>Souhaitez-vous une Assurance Choses pour l'Entreprise ? *</Label>
                    <RadioGroup 
                      value={businessForm.offreChoses} 
                      onValueChange={(v) => setBusinessForm(prev => ({ ...prev, offreChoses: v }))}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="oui" id="choses-oui" />
                          <label htmlFor="choses-oui">Oui</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="non" id="choses-non" />
                          <label htmlFor="choses-non">Non</label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  {businessForm.offreChoses === "oui" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="incendie"
                          checked={businessForm.incendie}
                          onCheckedChange={(checked) => setBusinessForm(prev => ({ ...prev, incendie: checked as boolean }))}
                        />
                        <label htmlFor="incendie">Incendie</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="evenements"
                          checked={businessForm.evenementsNaturels}
                          onCheckedChange={(checked) => setBusinessForm(prev => ({ ...prev, evenementsNaturels: checked as boolean }))}
                        />
                        <label htmlFor="evenements">Événements naturels</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="vol"
                          checked={businessForm.vol}
                          onCheckedChange={(checked) => setBusinessForm(prev => ({ ...prev, vol: checked as boolean }))}
                        />
                        <label htmlFor="vol">Vol</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="degat-eau"
                          checked={businessForm.degatEau}
                          onCheckedChange={(checked) => setBusinessForm(prev => ({ ...prev, degatEau: checked as boolean }))}
                        />
                        <label htmlFor="degat-eau">Dégât d'eau</label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Assurance personnes employés */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400">Assurances de personnes employés</h3>
                  
                  <div className="space-y-2">
                    <Label>Souhaitez-vous une assurance pour les employés ? *</Label>
                    <RadioGroup 
                      value={businessForm.offrePersonnes} 
                      onValueChange={(v) => setBusinessForm(prev => ({ ...prev, offrePersonnes: v }))}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="oui" id="pers-oui" />
                          <label htmlFor="pers-oui">Oui</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="non" id="pers-non" />
                          <label htmlFor="pers-non">Non</label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  {businessForm.offrePersonnes === "oui" && (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Nombre de Femmes</Label>
                          <Input
                            type="number"
                            value={businessForm.nbFemmes}
                            onChange={(e) => setBusinessForm(prev => ({ ...prev, nbFemmes: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Age moyen Femmes</Label>
                          <Input
                            type="number"
                            value={businessForm.ageMoyenFemmes}
                            onChange={(e) => setBusinessForm(prev => ({ ...prev, ageMoyenFemmes: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Somme salaires Femmes</Label>
                          <Input
                            placeholder="CHF"
                            value={businessForm.salairesFemmes}
                            onChange={(e) => setBusinessForm(prev => ({ ...prev, salairesFemmes: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Nombre d'Hommes</Label>
                          <Input
                            type="number"
                            value={businessForm.nbHommes}
                            onChange={(e) => setBusinessForm(prev => ({ ...prev, nbHommes: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Age moyen Hommes</Label>
                          <Input
                            type="number"
                            value={businessForm.ageMoyenHommes}
                            onChange={(e) => setBusinessForm(prev => ({ ...prev, ageMoyenHommes: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Somme salaires Hommes</Label>
                          <Input
                            placeholder="CHF"
                            value={businessForm.salairesHommes}
                            onChange={(e) => setBusinessForm(prev => ({ ...prev, salairesHommes: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Offre LAA Obligatoire ?</Label>
                          <RadioGroup 
                            value={businessForm.offreLAA} 
                            onValueChange={(v) => setBusinessForm(prev => ({ ...prev, offreLAA: v }))}
                          >
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="oui" id="laa-oui" />
                                <label htmlFor="laa-oui">Oui</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="non" id="laa-non" />
                                <label htmlFor="laa-non">Non</label>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                        <div className="space-y-2">
                          <Label>Offre LAA Complémentaire ?</Label>
                          <RadioGroup 
                            value={businessForm.offreLAAComplementaire} 
                            onValueChange={(v) => setBusinessForm(prev => ({ ...prev, offreLAAComplementaire: v }))}
                          >
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="oui" id="laac-oui" />
                                <label htmlFor="laac-oui">Oui</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="non" id="laac-non" />
                                <label htmlFor="laac-non">Non</label>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Perte de gain maladie collective ?</Label>
                          <RadioGroup 
                            value={businessForm.offrePerteGain} 
                            onValueChange={(v) => setBusinessForm(prev => ({ ...prev, offrePerteGain: v }))}
                          >
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="oui" id="pg-oui" />
                                <label htmlFor="pg-oui">Oui</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="non" id="pg-non" />
                                <label htmlFor="pg-non">Non</label>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                        <div className="space-y-2">
                          <Label>Assurance chef d'entreprise ?</Label>
                          <RadioGroup 
                            value={businessForm.offreChefEntreprise} 
                            onValueChange={(v) => setBusinessForm(prev => ({ ...prev, offreChefEntreprise: v }))}
                          >
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="oui" id="chef-oui" />
                                <label htmlFor="chef-oui">Oui</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="non" id="chef-non" />
                                <label htmlFor="chef-non">Non</label>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Finalisation */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400">Finalisation</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date du prochain RDV client *</Label>
                      <Input
                        type="date"
                        value={businessForm.dateRDV}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, dateRDV: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date d'effet *</Label>
                      <Input
                        type="date"
                        value={businessForm.dateEffet}
                        onChange={(e) => setBusinessForm(prev => ({ ...prev, dateEffet: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Email pour retour des offres *</Label>
                    <Input
                      type="email"
                      placeholder="Votre email"
                      value={businessForm.emailRetour}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, emailRetour: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Langue des offres</Label>
                    <RadioGroup 
                      value={businessForm.langue} 
                      onValueChange={(v) => setBusinessForm(prev => ({ ...prev, langue: v }))}
                      className="flex flex-wrap gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fr" id="lang-fr" />
                        <label htmlFor="lang-fr">Français</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="de" id="lang-de" />
                        <label htmlFor="lang-de">Allemand</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="it" id="lang-it" />
                        <label htmlFor="lang-it">Italien</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="en" id="lang-en" />
                        <label htmlFor="lang-en">Anglais</label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Commentaires</Label>
                    <Textarea
                      placeholder="Informations supplémentaires..."
                      value={businessForm.commentaires}
                      onChange={(e) => setBusinessForm(prev => ({ ...prev, commentaires: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div className="text-sm text-purple-700 dark:text-purple-300">
                      <p className="font-medium mb-1">Extrait du registre de commerce à inclure</p>
                      <a 
                        href="http://zefix.admin.ch/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline hover:no-underline"
                      >
                        http://zefix.admin.ch/
                      </a>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmitBusiness}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4 mr-2" />
                      Soumettre BUSINESS
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
