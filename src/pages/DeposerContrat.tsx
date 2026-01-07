import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCelebration } from "@/hooks/useCelebration";
import { useTenant } from "@/contexts/TenantContext";
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
  User, 
  Building2, 
  Heart,
  Shield,
  Briefcase,
  Upload,
  Mail,
  LogOut,
  FileText,
  Car,
  Home,
  Factory
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import SingleDocumentUpload from "@/components/crm/SingleDocumentUpload";
import lytaLogoFallback from "@/assets/lyta-logo-full.svg";

type UploadedDocument = {
  file_key: string;
  file_name: string;
  doc_kind: string;
  mime_type: string;
  size_bytes: number;
};

type VerifiedPartner = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
};

type FormType = 'sana' | 'vita' | 'medio' | 'business' | null;

// SANA Form - LAMal/LCA (Assurance Maladie)
type SanaFormData = {
  clientNom: string;
  clientPrenom: string;
  clientEmail: string;
  clientTel: string;
  dateNaissance: string;
  adresse: string;
  npa: string;
  localite: string;
  lamalDateEffet: string;
  lcaDateEffet: string;
  lcaProduction: string;
  assureurActuel: string;
  agentName: string;
  commentaires: string;
  confirmDocuments: boolean;
};

// VITA Form - Prévoyance/3e pilier (basé sur Federali)
type VitaFormData = {
  clientNom: string;
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

// MEDIO Form - Assurances Choses/RC/Auto
type MedioFormData = {
  // Preneur
  preneurNom: string;
  preneurPrenom: string;
  preneurEmail: string;
  preneurTel: string;
  preneurAdresse: string;
  preneurNpa: string;
  preneurLocalite: string;
  // Type d'assurance
  typeAssurance: string;
  // RC Privée
  rcPrivee: boolean;
  rcMontant: string;
  // Ménage
  menage: boolean;
  menageMontant: string;
  menageVol: boolean;
  // Auto
  auto: boolean;
  marqueVehicule: string;
  modeleVehicule: string;
  anneeVehicule: string;
  plaqueVehicule: string;
  // Dates
  dateEffet: string;
  agentName: string;
  commentaires: string;
  confirmDocuments: boolean;
};

// BUSINESS Form - Entreprises (basé sur Federali complet)
type BusinessFormData = {
  // Entreprise
  entrepriseNom: string;
  entrepriseActivite: string;
  formeSociete: string;
  nouvelleCreation: string;
  entrepriseAdresse: string;
  // Chef d'entreprise
  chefCivilite: string;
  chefPrenom: string;
  chefNom: string;
  chefDateNaissance: string;
  chefAdresse: string;
  chefNationalite: string;
  chefPermis: string;
  // RC Entreprise
  rcEntreprise: boolean;
  rcAssureurPrecedent: string;
  rcTypeContrat: string;
  rcChiffreAffaire: string;
  rcSommeAssurance: string;
  rcFranchise: string;
  // Assurance choses
  assuranceChoses: boolean;
  chosesIncendie: boolean;
  chosesIncendieMontant: string;
  chosesVol: boolean;
  chosesVolMontant: string;
  chosesDegatsEau: boolean;
  chosesDegatsEauMontant: string;
  // LAA
  laaObligatoire: boolean;
  laaComplementaire: boolean;
  nombreFemmes: string;
  ageMoyenFemmes: string;
  salairesFemmes: string;
  nombreHommes: string;
  ageMoyenHommes: string;
  salairesHommes: string;
  // Perte de gain maladie collective
  perteGainMaladie: boolean;
  // Général
  compagnies: string[];
  dateEffet: string;
  dateRdv: string;
  emailRetour: string;
  langue: string;
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
    subtitle: 'Prévoyance',
    description: '3e pilier et épargne',
    icon: Heart,
    color: 'from-red-500 to-red-600',
  },
  {
    id: 'medio' as FormType,
    title: 'MEDIO',
    subtitle: 'Assurances Privées',
    description: 'RC, Ménage, Auto',
    icon: Home,
    color: 'from-green-500 to-green-600',
  },
  {
    id: 'business' as FormType,
    title: 'BUSINESS',
    subtitle: 'Assurance Entreprise',
    description: 'RC Pro, LAA, Choses',
    icon: Factory,
    color: 'from-purple-500 to-purple-600',
  },
];

export default function DeposerContrat() {
  const { celebrate } = useCelebration();
  const { toast } = useToast();
  const { tenant, isLoading: tenantLoading } = useTenant();

  const tenantLogo = tenant?.branding?.logo_url || lytaLogoFallback;
  const tenantName = tenant?.branding?.display_name || tenant?.name || 'LYTA';
  const tenantPrimaryColor = tenant?.branding?.primary_color;

  const [verificationStep, setVerificationStep] = useState<'email' | 'selection' | 'form'>('email');
  const [partnerEmail, setPartnerEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifiedPartner, setVerifiedPartner] = useState<VerifiedPartner | null>(null);
  const [selectedFormType, setSelectedFormType] = useState<FormType>(null);
  const [submitting, setSubmitting] = useState(false);

  // SANA Form State
  const [sanaForm, setSanaForm] = useState<SanaFormData>({
    clientNom: "", clientPrenom: "", clientEmail: "", clientTel: "",
    dateNaissance: "", adresse: "", npa: "", localite: "",
    lamalDateEffet: "", lcaDateEffet: "", lcaProduction: "",
    assureurActuel: "", agentName: "", commentaires: "", confirmDocuments: false,
  });

  // VITA Form State
  const [vitaForm, setVitaForm] = useState<VitaFormData>({
    clientNom: "", clientPrenom: "", clientEmail: "", clientTel: "",
    vitaDateEffet: "", vitaDureeContrat: "", vitaPrimeMensuelle: "",
    agentName: "", commentaires: "", confirmDocuments: false,
  });

  // MEDIO Form State
  const [medioForm, setMedioForm] = useState<MedioFormData>({
    preneurNom: "", preneurPrenom: "", preneurEmail: "", preneurTel: "",
    preneurAdresse: "", preneurNpa: "", preneurLocalite: "",
    typeAssurance: "",
    rcPrivee: false, rcMontant: "5000000",
    menage: false, menageMontant: "", menageVol: false,
    auto: false, marqueVehicule: "", modeleVehicule: "", anneeVehicule: "", plaqueVehicule: "",
    dateEffet: "", agentName: "", commentaires: "", confirmDocuments: false,
  });

  // BUSINESS Form State
  const [businessForm, setBusinessForm] = useState<BusinessFormData>({
    entrepriseNom: "", entrepriseActivite: "", formeSociete: "", nouvelleCreation: "", entrepriseAdresse: "",
    chefCivilite: "", chefPrenom: "", chefNom: "", chefDateNaissance: "", chefAdresse: "", chefNationalite: "", chefPermis: "",
    rcEntreprise: false, rcAssureurPrecedent: "", rcTypeContrat: "", rcChiffreAffaire: "", rcSommeAssurance: "3000000", rcFranchise: "500",
    assuranceChoses: false, chosesIncendie: false, chosesIncendieMontant: "", chosesVol: false, chosesVolMontant: "", chosesDegatsEau: false, chosesDegatsEauMontant: "",
    laaObligatoire: false, laaComplementaire: false,
    nombreFemmes: "", ageMoyenFemmes: "", salairesFemmes: "", nombreHommes: "", ageMoyenHommes: "", salairesHommes: "",
    perteGainMaladie: false,
    compagnies: [], dateEffet: "", dateRdv: "", emailRetour: "", langue: "fr", commentaires: "",
  });

  // Documents state
  const [sanaDocuments, setSanaDocuments] = useState<UploadedDocument[]>([]);
  const [vitaDocuments, setVitaDocuments] = useState<UploadedDocument[]>([]);
  const [medioDocuments, setMedioDocuments] = useState<UploadedDocument[]>([]);
  const [businessDocuments, setBusinessDocuments] = useState<UploadedDocument[]>([]);

  // Required documents per form
  const sanaRequiredDocs = [
    "Pièce d'identité (recto/verso)",
    "Attestation de résidence / Permis de séjour",
    "Carte d'assuré actuelle",
    "Documents supplémentaires",
  ];

  const vitaRequiredDocs = [
    "Proposition avec déclaration de santé",
    "Pièce d'identité / attestation de domicile",
    "Procès-verbal de conseil",
    "Documents supplémentaires",
  ];

  const medioRequiredDocs = [
    "Pièce d'identité (recto/verso)",
    "Justificatif de domicile",
    "Carte grise véhicule (si auto)",
    "Police d'assurance actuelle",
    "Documents supplémentaires",
  ];

  const businessRequiredDocs = [
    "Extrait du registre du commerce (Zefix)",
    "Pièce d'identité du chef d'entreprise",
    "Liste du personnel avec salaires (si LAA)",
    "Documents supplémentaires",
  ];

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
      toast({ title: "Email requis", description: "Veuillez entrer votre adresse email", variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(partnerEmail.trim())) {
      toast({ title: "Email invalide", description: "Veuillez entrer une adresse email valide", variant: "destructive" });
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-partner-email', {
        body: { email: partnerEmail.trim().toLowerCase() }
      });
      if (error) throw new Error(error.message || "Erreur de vérification");
      if (data?.success && data?.partner) {
        setVerifiedPartner(data.partner);
        setVerificationStep('selection');
        toast({ title: "Bienvenue !", description: `Accès autorisé pour ${data.partner.name}` });
      } else {
        toast({ title: "Accès refusé", description: "Cet email n'est pas enregistré comme collaborateur", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible de vérifier l'email", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    setVerifiedPartner(null);
    setVerificationStep('email');
    setPartnerEmail("");
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

  const sendContractDepositEmail = async (formType: string, formData: any, documents: any[]) => {
    try {
      await supabase.functions.invoke('send-contract-deposit-email', {
        body: {
          contractData: {
            formType,
            clientName: formData.clientNom || formData.preneurNom || formData.chefNom || '',
            clientPrenom: formData.clientPrenom || formData.preneurPrenom || formData.chefPrenom || '',
            clientEmail: formData.clientEmail || formData.preneurEmail || formData.emailRetour || '',
            clientTel: formData.clientTel || formData.preneurTel || '',
            agentName: formData.agentName || verifiedPartner?.name || '',
            agentEmail: partnerEmail,
            formData,
            documents: documents.map(d => ({ file_name: d.file_name, doc_kind: d.doc_kind, file_key: d.file_key })),
            tenantSlug: 'lyta',
          }
        }
      });
    } catch (error) {
      console.error('Error sending contract deposit email:', error);
    }
  };

  const handleSubmitSana = async () => {
    if (!sanaForm.clientNom || !sanaForm.clientPrenom || !sanaForm.clientEmail) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    if (!sanaForm.confirmDocuments) {
      toast({ title: "Confirmation requise", description: "Veuillez confirmer avoir téléchargé les documents", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('deposit-contract', {
        body: {
          partnerEmail: partnerEmail,
          formType: 'sana',
          formData: sanaForm,
          startDate: sanaForm.lamalDateEffet || new Date().toISOString().split("T")[0],
          productType: 'sana',
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await sendContractDepositEmail('sana', sanaForm, sanaDocuments);
      celebrate("contract_added");
      toast({ title: "Formulaire SANA envoyé !", description: "Votre demande a été soumise avec succès" });
      setSanaForm({ clientNom: "", clientPrenom: "", clientEmail: "", clientTel: "", dateNaissance: "", adresse: "", npa: "", localite: "", lamalDateEffet: "", lcaDateEffet: "", lcaProduction: "", assureurActuel: "", agentName: verifiedPartner?.name || "", commentaires: "", confirmDocuments: false });
      setSanaDocuments([]);
      handleBackToSelection();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible de soumettre", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitVita = async () => {
    if (!vitaForm.clientNom || !vitaForm.clientPrenom || !vitaForm.clientEmail) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    if (!vitaForm.confirmDocuments) {
      toast({ title: "Confirmation requise", description: "Veuillez confirmer avoir téléchargé les documents", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('deposit-contract', {
        body: {
          partnerEmail: partnerEmail,
          formType: 'vita',
          formData: vitaForm,
          startDate: vitaForm.vitaDateEffet || new Date().toISOString().split("T")[0],
          premiumMonthly: parseFloat(vitaForm.vitaPrimeMensuelle) || 0,
          productType: 'vita',
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await sendContractDepositEmail('vita', vitaForm, vitaDocuments);
      celebrate("contract_added");
      toast({ title: "Formulaire VITA envoyé !", description: "Votre demande a été soumise avec succès" });
      setVitaForm({ clientNom: "", clientPrenom: "", clientEmail: "", clientTel: "", vitaDateEffet: "", vitaDureeContrat: "", vitaPrimeMensuelle: "", agentName: verifiedPartner?.name || "", commentaires: "", confirmDocuments: false });
      setVitaDocuments([]);
      handleBackToSelection();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible de soumettre", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMedio = async () => {
    if (!medioForm.preneurNom || !medioForm.preneurPrenom || !medioForm.preneurEmail) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    if (!medioForm.confirmDocuments) {
      toast({ title: "Confirmation requise", description: "Veuillez confirmer avoir téléchargé les documents", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('deposit-contract', {
        body: {
          partnerEmail: partnerEmail,
          formType: 'medio',
          formData: medioForm,
          startDate: medioForm.dateEffet || new Date().toISOString().split("T")[0],
          productType: 'medio',
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await sendContractDepositEmail('medio', medioForm, medioDocuments);
      celebrate("contract_added");
      toast({ title: "Formulaire MEDIO envoyé !", description: "Votre demande a été soumise avec succès" });
      setMedioForm({ preneurNom: "", preneurPrenom: "", preneurEmail: "", preneurTel: "", preneurAdresse: "", preneurNpa: "", preneurLocalite: "", typeAssurance: "", rcPrivee: false, rcMontant: "5000000", menage: false, menageMontant: "", menageVol: false, auto: false, marqueVehicule: "", modeleVehicule: "", anneeVehicule: "", plaqueVehicule: "", dateEffet: "", agentName: verifiedPartner?.name || "", commentaires: "", confirmDocuments: false });
      setMedioDocuments([]);
      handleBackToSelection();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible de soumettre", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBusiness = async () => {
    if (!businessForm.entrepriseNom || !businessForm.chefNom || !businessForm.emailRetour) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('deposit-contract', {
        body: {
          partnerEmail: partnerEmail,
          formType: 'business',
          formData: businessForm,
          startDate: businessForm.dateEffet || new Date().toISOString().split("T")[0],
          productType: 'business',
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await sendContractDepositEmail('business', businessForm, businessDocuments);
      celebrate("contract_added");
      toast({ title: "Formulaire BUSINESS envoyé !", description: "Votre demande a été soumise avec succès" });
      setBusinessForm({ entrepriseNom: "", entrepriseActivite: "", formeSociete: "", nouvelleCreation: "", entrepriseAdresse: "", chefCivilite: "", chefPrenom: "", chefNom: "", chefDateNaissance: "", chefAdresse: "", chefNationalite: "", chefPermis: "", rcEntreprise: false, rcAssureurPrecedent: "", rcTypeContrat: "", rcChiffreAffaire: "", rcSommeAssurance: "3000000", rcFranchise: "500", assuranceChoses: false, chosesIncendie: false, chosesIncendieMontant: "", chosesVol: false, chosesVolMontant: "", chosesDegatsEau: false, chosesDegatsEauMontant: "", laaObligatoire: false, laaComplementaire: false, nombreFemmes: "", ageMoyenFemmes: "", salairesFemmes: "", nombreHommes: "", ageMoyenHommes: "", salairesHommes: "", perteGainMaladie: false, compagnies: [], dateEffet: "", dateRdv: "", emailRetour: "", langue: "fr", commentaires: "" });
      setBusinessDocuments([]);
      handleBackToSelection();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible de soumettre", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Email verification screen
  if (verificationStep === 'email') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => window.location.href = '/connexion'}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <ThemeToggle />
            </div>
            <div className="flex justify-center">
              <img src={tenantLogo} alt={tenantName} className="h-12 max-w-[200px] object-contain" />
            </div>
            <div>
              <CardTitle>Dépôt de contrat</CardTitle>
              <CardDescription>Entrez votre email collaborateur pour accéder au formulaire</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partner-email">Email collaborateur</Label>
              <Input id="partner-email" type="email" placeholder="votre.email@entreprise.ch" value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleVerifyEmail()} />
            </div>
            <Button className="w-full" onClick={handleVerifyEmail} disabled={verifying} style={tenantPrimaryColor ? { backgroundColor: tenantPrimaryColor } : undefined}>
              {verifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Vérification...</> : <><Mail className="mr-2 h-4 w-4" />Accéder au formulaire</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form type selection screen
  if (verificationStep === 'selection') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur" style={tenantPrimaryColor ? { borderBottomColor: tenantPrimaryColor } : undefined}>
          <div className="container flex h-16 items-center justify-between">
            <img src={tenantLogo} alt={tenantName} className="h-8 max-w-[150px] object-contain" />
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: tenantPrimaryColor ? `${tenantPrimaryColor}15` : 'hsl(var(--primary)/0.1)' }}>
                <User className="h-4 w-4" style={{ color: tenantPrimaryColor || 'hsl(var(--primary))' }} />
                <span className="text-sm font-medium">{verifiedPartner?.name}</span>
              </div>
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Déconnexion</Button>
            </div>
          </div>
        </header>
        <main className="container py-12 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Dépôt de contrat</h1>
            <p className="text-muted-foreground">Sélectionnez le type de formulaire correspondant au produit</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {formTypes.map((form) => {
              const Icon = form.icon;
              return (
                <Card key={form.id} className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 hover:border-primary/50" onClick={() => handleSelectFormType(form.id)}>
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${form.color}`}>
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{form.title}</CardTitle>
                        <CardDescription className="font-medium">{form.subtitle}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{form.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-king" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur" style={tenantPrimaryColor ? { borderBottomColor: tenantPrimaryColor } : undefined}>
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackToSelection}><ArrowLeft className="h-5 w-5" /></Button>
            <img src={tenantLogo} alt={tenantName} className="h-8 max-w-[150px] object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: tenantPrimaryColor ? `${tenantPrimaryColor}15` : 'hsl(var(--primary)/0.1)' }}>
              <User className="h-4 w-4" style={{ color: tenantPrimaryColor || 'hsl(var(--primary))' }} />
              <span className="text-sm font-medium">{verifiedPartner?.name}</span>
            </div>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-4xl">

        {/* ============ SANA FORM ============ */}
        {selectedFormType === 'sana' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="block">Formulaire SANA</span>
                  <span className="text-sm font-normal text-muted-foreground">Assurance Maladie LAMal / LCA</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Client info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Informations du client</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input value={sanaForm.clientNom} onChange={(e) => setSanaForm(prev => ({ ...prev, clientNom: e.target.value }))} placeholder="Nom de famille" />
                  </div>
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input value={sanaForm.clientPrenom} onChange={(e) => setSanaForm(prev => ({ ...prev, clientPrenom: e.target.value }))} placeholder="Prénom" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={sanaForm.clientEmail} onChange={(e) => setSanaForm(prev => ({ ...prev, clientEmail: e.target.value }))} placeholder="email@exemple.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone *</Label>
                    <Input value={sanaForm.clientTel} onChange={(e) => setSanaForm(prev => ({ ...prev, clientTel: e.target.value }))} placeholder="+41 79 000 00 00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Date de naissance</Label>
                    <Input type="date" value={sanaForm.dateNaissance} onChange={(e) => setSanaForm(prev => ({ ...prev, dateNaissance: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Assureur actuel</Label>
                    <Input value={sanaForm.assureurActuel} onChange={(e) => setSanaForm(prev => ({ ...prev, assureurActuel: e.target.value }))} placeholder="Nom de la caisse actuelle" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Adresse</Label>
                    <Input value={sanaForm.adresse} onChange={(e) => setSanaForm(prev => ({ ...prev, adresse: e.target.value }))} placeholder="Rue et numéro" />
                  </div>
                  <div className="space-y-2">
                    <Label>NPA</Label>
                    <Input value={sanaForm.npa} onChange={(e) => setSanaForm(prev => ({ ...prev, npa: e.target.value }))} placeholder="1000" />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Localité</Label>
                    <Input value={sanaForm.localite} onChange={(e) => setSanaForm(prev => ({ ...prev, localite: e.target.value }))} placeholder="Ville" />
                  </div>
                </div>
              </div>

              {/* LAMal/LCA details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Détails LAMal / LCA</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                </div>
              </div>

              {/* Agent */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom de l'agent</Label>
                  <Input value={sanaForm.agentName} onChange={(e) => setSanaForm(prev => ({ ...prev, agentName: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Commentaires</Label>
                <Textarea value={sanaForm.commentaires} onChange={(e) => setSanaForm(prev => ({ ...prev, commentaires: e.target.value }))} placeholder="Informations complémentaires..." rows={3} />
              </div>

              {/* Documents */}
              <div className="space-y-4 p-4 border-2 rounded-lg" style={{ borderColor: tenantPrimaryColor || 'hsl(var(--primary)/0.3)', backgroundColor: tenantPrimaryColor ? `${tenantPrimaryColor}08` : 'hsl(var(--primary)/0.05)' }}>
                <div className="flex items-center gap-2" style={{ color: tenantPrimaryColor || 'hsl(var(--primary))' }}>
                  <FileText className="h-5 w-5" />
                  <h3 className="font-semibold">Documents à fournir</h3>
                </div>
                <div className="space-y-3">
                  {sanaRequiredDocs.map((doc, i) => (
                    <SingleDocumentUpload key={i} label={doc} docKind={`sana_doc_${i}`} onUpload={(d) => setSanaDocuments(prev => { const n = [...prev]; n[i] = d; return n; })} onRemove={() => setSanaDocuments(prev => prev.filter((_, idx) => idx !== i))} uploadedDocument={sanaDocuments[i] || null} required={i < 2} primaryColor={tenantPrimaryColor || undefined} />
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Checkbox id="sana-confirm" checked={sanaForm.confirmDocuments} onCheckedChange={(c) => setSanaForm(prev => ({ ...prev, confirmDocuments: c as boolean }))} />
                <div className="space-y-1">
                  <Label htmlFor="sana-confirm" className="font-medium cursor-pointer">Je confirme avoir téléchargé tous les documents requis</Label>
                  <p className="text-sm text-muted-foreground">Vous avez ajouté {sanaDocuments.filter(Boolean).length} document(s)</p>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleSubmitSana} disabled={submitting} style={tenantPrimaryColor ? { backgroundColor: tenantPrimaryColor } : undefined}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours...</> : <><Upload className="mr-2 h-4 w-4" />Soumettre le formulaire SANA</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ============ VITA FORM ============ */}
        {selectedFormType === 'vita' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600">
                  <Heart className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="block">Formulaire VITA</span>
                  <span className="text-sm font-normal text-muted-foreground">Prévoyance / 3e pilier</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Informations du client</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input value={vitaForm.clientNom} onChange={(e) => setVitaForm(prev => ({ ...prev, clientNom: e.target.value }))} placeholder="Nom de famille" />
                  </div>
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input value={vitaForm.clientPrenom} onChange={(e) => setVitaForm(prev => ({ ...prev, clientPrenom: e.target.value }))} placeholder="Prénom" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={vitaForm.clientEmail} onChange={(e) => setVitaForm(prev => ({ ...prev, clientEmail: e.target.value }))} placeholder="email@exemple.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone *</Label>
                    <Input value={vitaForm.clientTel} onChange={(e) => setVitaForm(prev => ({ ...prev, clientTel: e.target.value }))} placeholder="+41 79 000 00 00" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Détails du contrat VITA</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Date d'effet</Label>
                    <Input type="date" value={vitaForm.vitaDateEffet} onChange={(e) => setVitaForm(prev => ({ ...prev, vitaDateEffet: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Durée du contrat</Label>
                    <Select value={vitaForm.vitaDureeContrat} onValueChange={(v) => setVitaForm(prev => ({ ...prev, vitaDureeContrat: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
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
                    <Label>Prime mensuelle nette (CHF)</Label>
                    <Input type="number" value={vitaForm.vitaPrimeMensuelle} onChange={(e) => setVitaForm(prev => ({ ...prev, vitaPrimeMensuelle: e.target.value }))} placeholder="Diviser par 12 si annuelle" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nom de l'agent</Label>
                <Input value={vitaForm.agentName} onChange={(e) => setVitaForm(prev => ({ ...prev, agentName: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label>Commentaires</Label>
                <Textarea value={vitaForm.commentaires} onChange={(e) => setVitaForm(prev => ({ ...prev, commentaires: e.target.value }))} placeholder="Informations complémentaires..." rows={3} />
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">⚠️ Documents requis pour VITA :</p>
                <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 space-y-1">
                  <li><strong>Proposition avec déclaration de santé</strong></li>
                  <li>Copie des pièces d'identité (certifiées signées et datées)</li>
                  <li>Formulaire d'adéquation (PAX Quicksales)</li>
                  <li>Formulaire débit direct (confirmer l'envoi à la banque)</li>
                  <li><strong>Procès-verbal de conseil (VITA)</strong></li>
                </ul>
              </div>

              <div className="space-y-4 p-4 border-2 rounded-lg" style={{ borderColor: tenantPrimaryColor || 'hsl(var(--primary)/0.3)', backgroundColor: tenantPrimaryColor ? `${tenantPrimaryColor}08` : 'hsl(var(--primary)/0.05)' }}>
                <div className="flex items-center gap-2" style={{ color: tenantPrimaryColor || 'hsl(var(--primary))' }}>
                  <FileText className="h-5 w-5" />
                  <h3 className="font-semibold">Documents à fournir</h3>
                </div>
                <div className="space-y-3">
                  {vitaRequiredDocs.map((doc, i) => (
                    <SingleDocumentUpload key={i} label={doc} docKind={`vita_doc_${i}`} onUpload={(d) => setVitaDocuments(prev => { const n = [...prev]; n[i] = d; return n; })} onRemove={() => setVitaDocuments(prev => prev.filter((_, idx) => idx !== i))} uploadedDocument={vitaDocuments[i] || null} required={i < 3} primaryColor={tenantPrimaryColor || undefined} />
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Checkbox id="vita-confirm" checked={vitaForm.confirmDocuments} onCheckedChange={(c) => setVitaForm(prev => ({ ...prev, confirmDocuments: c as boolean }))} />
                <div className="space-y-1">
                  <Label htmlFor="vita-confirm" className="font-medium cursor-pointer">Je confirme avoir téléchargé tous les documents requis</Label>
                  <p className="text-sm text-muted-foreground">Vous avez ajouté {vitaDocuments.filter(Boolean).length} document(s)</p>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleSubmitVita} disabled={submitting} style={tenantPrimaryColor ? { backgroundColor: tenantPrimaryColor } : undefined}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours...</> : <><Upload className="mr-2 h-4 w-4" />Soumettre le formulaire VITA</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ============ MEDIO FORM ============ */}
        {selectedFormType === 'medio' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600">
                  <Home className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="block">Formulaire MEDIO</span>
                  <span className="text-sm font-normal text-muted-foreground">RC Privée / Ménage / Auto</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Informations du preneur</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input value={medioForm.preneurNom} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurNom: e.target.value }))} placeholder="Nom de famille" />
                  </div>
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input value={medioForm.preneurPrenom} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurPrenom: e.target.value }))} placeholder="Prénom" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={medioForm.preneurEmail} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurEmail: e.target.value }))} placeholder="email@exemple.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone *</Label>
                    <Input value={medioForm.preneurTel} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurTel: e.target.value }))} placeholder="+41 79 000 00 00" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Adresse</Label>
                    <Input value={medioForm.preneurAdresse} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurAdresse: e.target.value }))} placeholder="Rue et numéro" />
                  </div>
                  <div className="space-y-2">
                    <Label>NPA</Label>
                    <Input value={medioForm.preneurNpa} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurNpa: e.target.value }))} placeholder="1000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Localité</Label>
                    <Input value={medioForm.preneurLocalite} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurLocalite: e.target.value }))} placeholder="Ville" />
                  </div>
                </div>
              </div>

              {/* RC Privée */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox checked={medioForm.rcPrivee} onCheckedChange={(c) => setMedioForm(prev => ({ ...prev, rcPrivee: c as boolean }))} id="rc-privee" />
                  <Label htmlFor="rc-privee" className="font-semibold text-lg cursor-pointer">Responsabilité Civile Privée</Label>
                </div>
                {medioForm.rcPrivee && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label>Somme d'assurance</Label>
                      <Select value={medioForm.rcMontant} onValueChange={(v) => setMedioForm(prev => ({ ...prev, rcMontant: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3000000">3 Mio CHF</SelectItem>
                          <SelectItem value="5000000">5 Mio CHF</SelectItem>
                          <SelectItem value="10000000">10 Mio CHF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Ménage */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox checked={medioForm.menage} onCheckedChange={(c) => setMedioForm(prev => ({ ...prev, menage: c as boolean }))} id="menage" />
                  <Label htmlFor="menage" className="font-semibold text-lg cursor-pointer">Assurance Ménage</Label>
                </div>
                {medioForm.menage && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label>Valeur du mobilier (CHF)</Label>
                      <Input type="number" value={medioForm.menageMontant} onChange={(e) => setMedioForm(prev => ({ ...prev, menageMontant: e.target.value }))} placeholder="50000" />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <Checkbox checked={medioForm.menageVol} onCheckedChange={(c) => setMedioForm(prev => ({ ...prev, menageVol: c as boolean }))} id="menage-vol" />
                      <Label htmlFor="menage-vol" className="cursor-pointer">Inclure couverture vol</Label>
                    </div>
                  </div>
                )}
              </div>

              {/* Auto */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox checked={medioForm.auto} onCheckedChange={(c) => setMedioForm(prev => ({ ...prev, auto: c as boolean }))} id="auto" />
                  <Label htmlFor="auto" className="font-semibold text-lg cursor-pointer flex items-center gap-2"><Car className="h-5 w-5" /> Assurance Auto</Label>
                </div>
                {medioForm.auto && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label>Marque</Label>
                      <Input value={medioForm.marqueVehicule} onChange={(e) => setMedioForm(prev => ({ ...prev, marqueVehicule: e.target.value }))} placeholder="Ex: Volkswagen" />
                    </div>
                    <div className="space-y-2">
                      <Label>Modèle</Label>
                      <Input value={medioForm.modeleVehicule} onChange={(e) => setMedioForm(prev => ({ ...prev, modeleVehicule: e.target.value }))} placeholder="Ex: Golf" />
                    </div>
                    <div className="space-y-2">
                      <Label>Année</Label>
                      <Input value={medioForm.anneeVehicule} onChange={(e) => setMedioForm(prev => ({ ...prev, anneeVehicule: e.target.value }))} placeholder="2020" />
                    </div>
                    <div className="space-y-2">
                      <Label>Plaque / Immatriculation</Label>
                      <Input value={medioForm.plaqueVehicule} onChange={(e) => setMedioForm(prev => ({ ...prev, plaqueVehicule: e.target.value }))} placeholder="GE 123456" />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date d'effet souhaitée</Label>
                  <Input type="date" value={medioForm.dateEffet} onChange={(e) => setMedioForm(prev => ({ ...prev, dateEffet: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Nom de l'agent</Label>
                  <Input value={medioForm.agentName} onChange={(e) => setMedioForm(prev => ({ ...prev, agentName: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Commentaires</Label>
                <Textarea value={medioForm.commentaires} onChange={(e) => setMedioForm(prev => ({ ...prev, commentaires: e.target.value }))} placeholder="Besoins spécifiques, franchises souhaitées..." rows={3} />
              </div>

              <div className="space-y-4 p-4 border-2 rounded-lg" style={{ borderColor: tenantPrimaryColor || 'hsl(var(--primary)/0.3)', backgroundColor: tenantPrimaryColor ? `${tenantPrimaryColor}08` : 'hsl(var(--primary)/0.05)' }}>
                <div className="flex items-center gap-2" style={{ color: tenantPrimaryColor || 'hsl(var(--primary))' }}>
                  <FileText className="h-5 w-5" />
                  <h3 className="font-semibold">Documents à fournir</h3>
                </div>
                <div className="space-y-3">
                  {medioRequiredDocs.map((doc, i) => (
                    <SingleDocumentUpload key={i} label={doc} docKind={`medio_doc_${i}`} onUpload={(d) => setMedioDocuments(prev => { const n = [...prev]; n[i] = d; return n; })} onRemove={() => setMedioDocuments(prev => prev.filter((_, idx) => idx !== i))} uploadedDocument={medioDocuments[i] || null} required={i < 2} primaryColor={tenantPrimaryColor || undefined} />
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Checkbox id="medio-confirm" checked={medioForm.confirmDocuments} onCheckedChange={(c) => setMedioForm(prev => ({ ...prev, confirmDocuments: c as boolean }))} />
                <div className="space-y-1">
                  <Label htmlFor="medio-confirm" className="font-medium cursor-pointer">Je confirme avoir téléchargé tous les documents requis</Label>
                  <p className="text-sm text-muted-foreground">Vous avez ajouté {medioDocuments.filter(Boolean).length} document(s)</p>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleSubmitMedio} disabled={submitting} style={tenantPrimaryColor ? { backgroundColor: tenantPrimaryColor } : undefined}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours...</> : <><Upload className="mr-2 h-4 w-4" />Soumettre le formulaire MEDIO</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ============ BUSINESS FORM ============ */}
        {selectedFormType === 'business' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600">
                  <Factory className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="block">Formulaire BUSINESS</span>
                  <span className="text-sm font-normal text-muted-foreground">Assurance Entreprise complète</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Renseignements généraux */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2"><Building2 className="h-5 w-5" /> Renseignements généraux</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom de l'entreprise *</Label>
                    <Input value={businessForm.entrepriseNom} onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseNom: e.target.value }))} placeholder="Raison sociale" />
                  </div>
                  <div className="space-y-2">
                    <Label>Activité de l'entreprise *</Label>
                    <Input value={businessForm.entrepriseActivite} onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseActivite: e.target.value }))} placeholder="Secteur d'activité" />
                  </div>
                  <div className="space-y-2">
                    <Label>Forme de la société *</Label>
                    <Select value={businessForm.formeSociete} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, formeSociete: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sa">SA</SelectItem>
                        <SelectItem value="sarl">Sàrl</SelectItem>
                        <SelectItem value="snc">Société en Nom Collectif</SelectItem>
                        <SelectItem value="ri">Raison individuelle</SelectItem>
                        <SelectItem value="association">Association</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nouvelle création ? *</Label>
                    <RadioGroup value={businessForm.nouvelleCreation} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, nouvelleCreation: v }))} className="flex gap-4 pt-2">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="oui" id="nc-oui" /><Label htmlFor="nc-oui">Oui</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="non" id="nc-non" /><Label htmlFor="nc-non">Non</Label></div>
                    </RadioGroup>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Adresse de l'entreprise *</Label>
                  <Textarea value={businessForm.entrepriseAdresse} onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseAdresse: e.target.value }))} placeholder="Adresse complète" rows={2} />
                </div>
              </div>

              {/* Chef d'entreprise */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2"><User className="h-5 w-5" /> Chef d'entreprise</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Civilité *</Label>
                    <Select value={businessForm.chefCivilite} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, chefCivilite: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="m">Monsieur</SelectItem>
                        <SelectItem value="mme">Madame</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input value={businessForm.chefPrenom} onChange={(e) => setBusinessForm(prev => ({ ...prev, chefPrenom: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input value={businessForm.chefNom} onChange={(e) => setBusinessForm(prev => ({ ...prev, chefNom: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date de naissance</Label>
                    <Input type="date" value={businessForm.chefDateNaissance} onChange={(e) => setBusinessForm(prev => ({ ...prev, chefDateNaissance: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nationalité *</Label>
                    <Input value={businessForm.chefNationalite} onChange={(e) => setBusinessForm(prev => ({ ...prev, chefNationalite: e.target.value }))} placeholder="Suisse" />
                  </div>
                  <div className="space-y-2">
                    <Label>Permis de séjour *</Label>
                    <Select value={businessForm.chefPermis} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, chefPermis: v }))}>
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
                <div className="space-y-2">
                  <Label>Adresse du chef d'entreprise *</Label>
                  <Input value={businessForm.chefAdresse} onChange={(e) => setBusinessForm(prev => ({ ...prev, chefAdresse: e.target.value }))} placeholder="Adresse complète" />
                </div>
              </div>

              {/* RC Entreprise */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Checkbox checked={businessForm.rcEntreprise} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, rcEntreprise: c as boolean }))} id="rc-entreprise" />
                  <Label htmlFor="rc-entreprise" className="font-semibold text-lg cursor-pointer text-purple-700 dark:text-purple-300">Responsabilité Civile Entreprise</Label>
                </div>
                {businessForm.rcEntreprise && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Assureur précédent ?</Label>
                        <RadioGroup value={businessForm.rcAssureurPrecedent} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, rcAssureurPrecedent: v }))} className="flex gap-4">
                          <div className="flex items-center space-x-2"><RadioGroupItem value="oui" id="rca-oui" /><Label htmlFor="rca-oui">Oui</Label></div>
                          <div className="flex items-center space-x-2"><RadioGroupItem value="non" id="rca-non" /><Label htmlFor="rca-non">Non</Label></div>
                        </RadioGroup>
                      </div>
                      <div className="space-y-2">
                        <Label>Type de contrat RC</Label>
                        <Select value={businessForm.rcTypeContrat} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, rcTypeContrat: v }))}>
                          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="base">RC de base (Bureau)</SelectItem>
                            <SelectItem value="specifique">RC spécifique à l'activité</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Chiffre d'affaires (CHF)</Label>
                        <Input type="number" value={businessForm.rcChiffreAffaire} onChange={(e) => setBusinessForm(prev => ({ ...prev, rcChiffreAffaire: e.target.value }))} placeholder="500000" />
                      </div>
                      <div className="space-y-2">
                        <Label>Somme d'assurance</Label>
                        <Select value={businessForm.rcSommeAssurance} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, rcSommeAssurance: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3000000">3 Mio CHF</SelectItem>
                            <SelectItem value="5000000">5 Mio CHF</SelectItem>
                            <SelectItem value="10000000">10 Mio CHF</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Franchise</Label>
                        <Select value={businessForm.rcFranchise} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, rcFranchise: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0.-</SelectItem>
                            <SelectItem value="200">200.-</SelectItem>
                            <SelectItem value="500">500.-</SelectItem>
                            <SelectItem value="1000">1'000.-</SelectItem>
                            <SelectItem value="2000">2'000.-</SelectItem>
                            <SelectItem value="5000">5'000.-</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Assurance choses */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Checkbox checked={businessForm.assuranceChoses} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, assuranceChoses: c as boolean }))} id="assurance-choses" />
                  <Label htmlFor="assurance-choses" className="font-semibold text-lg cursor-pointer text-purple-700 dark:text-purple-300">Assurance Choses Entreprise</Label>
                </div>
                {businessForm.assuranceChoses && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={businessForm.chosesIncendie} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, chosesIncendie: c as boolean }))} id="choses-incendie" />
                        <Label htmlFor="choses-incendie" className="cursor-pointer">Incendie</Label>
                      </div>
                      {businessForm.chosesIncendie && (
                        <div className="space-y-2 md:col-span-2">
                          <Input type="number" value={businessForm.chosesIncendieMontant} onChange={(e) => setBusinessForm(prev => ({ ...prev, chosesIncendieMontant: e.target.value }))} placeholder="Valeur totale CHF" />
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={businessForm.chosesVol} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, chosesVol: c as boolean }))} id="choses-vol" />
                        <Label htmlFor="choses-vol" className="cursor-pointer">Vol</Label>
                      </div>
                      {businessForm.chosesVol && (
                        <div className="space-y-2 md:col-span-2">
                          <Input type="number" value={businessForm.chosesVolMontant} onChange={(e) => setBusinessForm(prev => ({ ...prev, chosesVolMontant: e.target.value }))} placeholder="Somme d'assurance CHF" />
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={businessForm.chosesDegatsEau} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, chosesDegatsEau: c as boolean }))} id="choses-eau" />
                        <Label htmlFor="choses-eau" className="cursor-pointer">Dégâts d'eau</Label>
                      </div>
                      {businessForm.chosesDegatsEau && (
                        <div className="space-y-2 md:col-span-2">
                          <Input type="number" value={businessForm.chosesDegatsEauMontant} onChange={(e) => setBusinessForm(prev => ({ ...prev, chosesDegatsEauMontant: e.target.value }))} placeholder="Valeur totale CHF" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* LAA */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h4 className="font-semibold text-purple-700 dark:text-purple-300">Assurances de personnes employés</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={businessForm.laaObligatoire} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, laaObligatoire: c as boolean }))} id="laa-oblig" />
                    <Label htmlFor="laa-oblig" className="cursor-pointer">LAA Obligatoire</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox checked={businessForm.laaComplementaire} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, laaComplementaire: c as boolean }))} id="laa-comp" />
                    <Label htmlFor="laa-comp" className="cursor-pointer">LAA Complémentaire</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox checked={businessForm.perteGainMaladie} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, perteGainMaladie: c as boolean }))} id="pgm" />
                    <Label htmlFor="pgm" className="cursor-pointer">Perte de gain maladie collective</Label>
                  </div>
                </div>
                {(businessForm.laaObligatoire || businessForm.laaComplementaire || businessForm.perteGainMaladie) && (
                  <div className="space-y-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Effectif des employés :</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Nombre de femmes</Label>
                        <Input type="number" value={businessForm.nombreFemmes} onChange={(e) => setBusinessForm(prev => ({ ...prev, nombreFemmes: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Âge moyen femmes</Label>
                        <Input type="number" value={businessForm.ageMoyenFemmes} onChange={(e) => setBusinessForm(prev => ({ ...prev, ageMoyenFemmes: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Somme salaires femmes (annuel)</Label>
                        <Input type="number" value={businessForm.salairesFemmes} onChange={(e) => setBusinessForm(prev => ({ ...prev, salairesFemmes: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Nombre d'hommes</Label>
                        <Input type="number" value={businessForm.nombreHommes} onChange={(e) => setBusinessForm(prev => ({ ...prev, nombreHommes: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Âge moyen hommes</Label>
                        <Input type="number" value={businessForm.ageMoyenHommes} onChange={(e) => setBusinessForm(prev => ({ ...prev, ageMoyenHommes: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Somme salaires hommes (annuel)</Label>
                        <Input type="number" value={businessForm.salairesHommes} onChange={(e) => setBusinessForm(prev => ({ ...prev, salairesHommes: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Finalisation */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Finalisation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date d'effet souhaitée *</Label>
                    <Input type="date" value={businessForm.dateEffet} onChange={(e) => setBusinessForm(prev => ({ ...prev, dateEffet: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date du prochain RDV client</Label>
                    <Input type="date" value={businessForm.dateRdv} onChange={(e) => setBusinessForm(prev => ({ ...prev, dateRdv: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email pour retour des offres *</Label>
                    <Input type="email" value={businessForm.emailRetour} onChange={(e) => setBusinessForm(prev => ({ ...prev, emailRetour: e.target.value }))} placeholder="email@entreprise.ch" />
                  </div>
                  <div className="space-y-2">
                    <Label>Langue des offres</Label>
                    <Select value={businessForm.langue} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, langue: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Allemand</SelectItem>
                        <SelectItem value="it">Italien</SelectItem>
                        <SelectItem value="en">Anglais</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Commentaires</Label>
                  <Textarea value={businessForm.commentaires} onChange={(e) => setBusinessForm(prev => ({ ...prev, commentaires: e.target.value }))} placeholder="Besoins spécifiques, détails supplémentaires..." rows={4} />
                </div>
              </div>

              {/* Documents */}
              <div className="space-y-4 p-4 border-2 rounded-lg" style={{ borderColor: tenantPrimaryColor || 'hsl(var(--primary)/0.3)', backgroundColor: tenantPrimaryColor ? `${tenantPrimaryColor}08` : 'hsl(var(--primary)/0.05)' }}>
                <div className="flex items-center gap-2" style={{ color: tenantPrimaryColor || 'hsl(var(--primary))' }}>
                  <FileText className="h-5 w-5" />
                  <h3 className="font-semibold">Documents à fournir</h3>
                </div>
                <p className="text-sm text-muted-foreground">Extrait du registre du commerce à inclure : <a href="http://zefix.admin.ch/" target="_blank" rel="noopener noreferrer" className="text-primary underline">zefix.admin.ch</a></p>
                <div className="space-y-3">
                  {businessRequiredDocs.map((doc, i) => (
                    <SingleDocumentUpload key={i} label={doc} docKind={`business_doc_${i}`} onUpload={(d) => setBusinessDocuments(prev => { const n = [...prev]; n[i] = d; return n; })} onRemove={() => setBusinessDocuments(prev => prev.filter((_, idx) => idx !== i))} uploadedDocument={businessDocuments[i] || null} required={i < 2} primaryColor={tenantPrimaryColor || undefined} />
                  ))}
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleSubmitBusiness} disabled={submitting} style={tenantPrimaryColor ? { backgroundColor: tenantPrimaryColor } : undefined}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours...</> : <><Upload className="mr-2 h-4 w-4" />Soumettre le formulaire BUSINESS</>}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
