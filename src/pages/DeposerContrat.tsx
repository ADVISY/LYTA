import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { IAScanUpload, IAScanValidation, type ScanResults } from "@/components/crm/ia-scan";
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

const getFormTypes = (t: (key: string) => string) => [
  {
    id: 'sana' as FormType,
    title: 'SANA',
    subtitle: t('depositContract.sana.subtitle'),
    description: t('depositContract.sana.description'),
    icon: Shield,
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'vita' as FormType,
    title: 'VITA',
    subtitle: t('depositContract.vita.subtitle'),
    description: t('depositContract.vita.description'),
    icon: Heart,
    color: 'from-red-500 to-red-600',
  },
  {
    id: 'medio' as FormType,
    title: 'MEDIO',
    subtitle: t('depositContract.medio.subtitle'),
    description: t('depositContract.medio.description'),
    icon: Home,
    color: 'from-green-500 to-green-600',
  },
  {
    id: 'business' as FormType,
    title: 'BUSINESS',
    subtitle: t('depositContract.business.subtitle'),
    description: t('depositContract.business.description'),
    icon: Factory,
    color: 'from-purple-500 to-purple-600',
  },
];

export default function DeposerContrat() {
  const { t } = useTranslation();
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

  // IA Scan state
  const [sanaScanResults, setSanaScanResults] = useState<ScanResults | null>(null);
  const [vitaScanResults, setVitaScanResults] = useState<ScanResults | null>(null);
  const [medioScanResults, setMedioScanResults] = useState<ScanResults | null>(null);
  const [businessScanResults, setBusinessScanResults] = useState<ScanResults | null>(null);

  // Required documents per form
  const sanaRequiredDocs = [
    t('depositContract.sana.docs.identity'),
    t('depositContract.sana.docs.residence'),
    t('depositContract.sana.docs.insuranceCard'),
    t('depositContract.common.additionalDocs'),
  ];

  const vitaRequiredDocs = [
    t('depositContract.vita.docs.proposal'),
    t('depositContract.vita.docs.identityDomicile'),
    t('depositContract.vita.docs.minutes'),
    t('depositContract.common.additionalDocs'),
  ];

  const medioRequiredDocs = [
    t('depositContract.medio.docs.identity'),
    t('depositContract.medio.docs.domicile'),
    t('depositContract.medio.docs.vehicleRegistration'),
    t('depositContract.medio.docs.currentPolicy'),
    t('depositContract.common.additionalDocs'),
  ];

  const businessRequiredDocs = [
    t('depositContract.business.docs.commerceExtract'),
    t('depositContract.business.docs.ceoIdentity'),
    t('depositContract.business.docs.staffList'),
    t('depositContract.common.additionalDocs'),
  ];

  const formTypes = getFormTypes(t);

  useEffect(() => {
    if (verifiedPartner) {
      const agentName = verifiedPartner.name || `${verifiedPartner.firstName || ''} ${verifiedPartner.lastName || ''}`.trim();
      setSanaForm(prev => ({ ...prev, agentName }));
      setVitaForm(prev => ({ ...prev, agentName }));
      setMedioForm(prev => ({ ...prev, agentName }));
    }
  }, [verifiedPartner]);

  // Handle IA Scan results - prefill form with extracted data
  const handleSanaScanValidate = (validatedFields: Record<string, string>) => {
    setSanaForm(prev => ({
      ...prev,
      clientNom: validatedFields.nom || prev.clientNom,
      clientPrenom: validatedFields.prenom || prev.clientPrenom,
      clientEmail: validatedFields.email || prev.clientEmail,
      clientTel: validatedFields.telephone || prev.clientTel,
      dateNaissance: validatedFields.date_naissance || prev.dateNaissance,
      adresse: validatedFields.adresse || prev.adresse,
      npa: validatedFields.npa || prev.npa,
      localite: validatedFields.localite || prev.localite,
      assureurActuel: validatedFields.compagnie || prev.assureurActuel,
    }));
    setSanaScanResults(null);
    toast({ title: "Formulaire pré-rempli", description: "Les données ont été appliquées au formulaire" });
  };

  const handleVitaScanValidate = (validatedFields: Record<string, string>) => {
    setVitaForm(prev => ({
      ...prev,
      clientNom: validatedFields.nom || prev.clientNom,
      clientPrenom: validatedFields.prenom || prev.clientPrenom,
      clientEmail: validatedFields.email || prev.clientEmail,
      clientTel: validatedFields.telephone || prev.clientTel,
      vitaPrimeMensuelle: validatedFields.prime_mensuelle || prev.vitaPrimeMensuelle,
      vitaDateEffet: validatedFields.date_debut || prev.vitaDateEffet,
      vitaDureeContrat: validatedFields.duree_contrat || prev.vitaDureeContrat,
    }));
    setVitaScanResults(null);
    toast({ title: "Formulaire pré-rempli", description: "Les données ont été appliquées au formulaire" });
  };

  const handleMedioScanValidate = (validatedFields: Record<string, string>) => {
    setMedioForm(prev => ({
      ...prev,
      preneurNom: validatedFields.nom || prev.preneurNom,
      preneurPrenom: validatedFields.prenom || prev.preneurPrenom,
      preneurEmail: validatedFields.email || prev.preneurEmail,
      preneurTel: validatedFields.telephone || prev.preneurTel,
      preneurAdresse: validatedFields.adresse || prev.preneurAdresse,
      preneurNpa: validatedFields.npa || prev.preneurNpa,
      preneurLocalite: validatedFields.localite || prev.preneurLocalite,
      dateEffet: validatedFields.date_debut || prev.dateEffet,
    }));
    setMedioScanResults(null);
    toast({ title: "Formulaire pré-rempli", description: "Les données ont été appliquées au formulaire" });
  };

  const handleBusinessScanValidate = (validatedFields: Record<string, string>) => {
    setBusinessForm(prev => ({
      ...prev,
      entrepriseNom: validatedFields.compagnie || prev.entrepriseNom,
      chefNom: validatedFields.nom || prev.chefNom,
      chefPrenom: validatedFields.prenom || prev.chefPrenom,
      chefDateNaissance: validatedFields.date_naissance || prev.chefDateNaissance,
      chefAdresse: validatedFields.adresse || prev.chefAdresse,
      dateEffet: validatedFields.date_debut || prev.dateEffet,
      emailRetour: validatedFields.email || prev.emailRetour,
    }));
    setBusinessScanResults(null);
    toast({ title: "Formulaire pré-rempli", description: "Les données ont été appliquées au formulaire" });
  };

  const handleVerifyEmail = async () => {
    if (!partnerEmail.trim()) {
      toast({ title: t('depositContract.emailRequired'), description: t('depositContract.enterEmail'), variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(partnerEmail.trim())) {
      toast({ title: t('depositContract.invalidEmail'), description: t('depositContract.enterValidEmail'), variant: "destructive" });
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-partner-email', {
        body: { email: partnerEmail.trim().toLowerCase() }
      });
      if (error) throw new Error(error.message || t('depositContract.verificationError'));
      if (data?.success && data?.partner) {
        setVerifiedPartner(data.partner);
        setVerificationStep('selection');
        toast({ title: t('depositContract.welcome'), description: t('depositContract.accessGranted', { name: data.partner.name }) });
      } else {
        toast({ title: t('depositContract.accessDenied'), description: t('depositContract.emailNotRegistered'), variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || t('depositContract.cannotVerify'), variant: "destructive" });
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
      const { data, error } = await supabase.functions.invoke('send-contract-deposit-email', {
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
            tenantSlug: tenant?.slug,
          },
          // Always notify the submitting collaborator as a minimum
          notificationEmails: [partnerEmail.trim().toLowerCase()].filter(Boolean),
        }
      });

      if (error) {
        console.error('Error sending contract deposit email:', error);
        return { ok: false, error: error.message };
      }

      return { ok: true, data };
    } catch (error: any) {
      console.error('Error sending contract deposit email:', error);
      return { ok: false, error: error?.message || 'Unknown error' };
    }
  };

  const handleSubmitSana = async () => {
    if (!sanaForm.clientNom || !sanaForm.clientPrenom || !sanaForm.clientEmail) {
      toast({ title: t('common.error'), description: t('depositContract.fillRequired'), variant: "destructive" });
      return;
    }
    if (!sanaForm.confirmDocuments) {
      toast({ title: t('depositContract.confirmRequired'), description: t('depositContract.confirmDocsUpload'), variant: "destructive" });
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
      toast({ title: t('depositContract.formSent', { type: 'SANA' }), description: t('depositContract.requestSubmitted') });
      setSanaForm({ clientNom: "", clientPrenom: "", clientEmail: "", clientTel: "", dateNaissance: "", adresse: "", npa: "", localite: "", lamalDateEffet: "", lcaDateEffet: "", lcaProduction: "", assureurActuel: "", agentName: verifiedPartner?.name || "", commentaires: "", confirmDocuments: false });
      setSanaDocuments([]);
      handleBackToSelection();
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || t('depositContract.cannotSubmit'), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitVita = async () => {
    if (!vitaForm.clientNom || !vitaForm.clientPrenom || !vitaForm.clientEmail) {
      toast({ title: t('common.error'), description: t('depositContract.fillRequired'), variant: "destructive" });
      return;
    }
    if (!vitaForm.confirmDocuments) {
      toast({ title: t('depositContract.confirmRequired'), description: t('depositContract.confirmDocsUpload'), variant: "destructive" });
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
      toast({ title: t('depositContract.formSent', { type: 'VITA' }), description: t('depositContract.requestSubmitted') });
      setVitaForm({ clientNom: "", clientPrenom: "", clientEmail: "", clientTel: "", vitaDateEffet: "", vitaDureeContrat: "", vitaPrimeMensuelle: "", agentName: verifiedPartner?.name || "", commentaires: "", confirmDocuments: false });
      setVitaDocuments([]);
      handleBackToSelection();
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || t('depositContract.cannotSubmit'), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMedio = async () => {
    if (!medioForm.preneurNom || !medioForm.preneurPrenom || !medioForm.preneurEmail) {
      toast({ title: t('common.error'), description: t('depositContract.fillRequired'), variant: "destructive" });
      return;
    }
    if (!medioForm.confirmDocuments) {
      toast({ title: t('depositContract.confirmRequired'), description: t('depositContract.confirmDocsUpload'), variant: "destructive" });
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
      toast({ title: t('depositContract.formSent', { type: 'MEDIO' }), description: t('depositContract.requestSubmitted') });
      setMedioForm({ preneurNom: "", preneurPrenom: "", preneurEmail: "", preneurTel: "", preneurAdresse: "", preneurNpa: "", preneurLocalite: "", typeAssurance: "", rcPrivee: false, rcMontant: "5000000", menage: false, menageMontant: "", menageVol: false, auto: false, marqueVehicule: "", modeleVehicule: "", anneeVehicule: "", plaqueVehicule: "", dateEffet: "", agentName: verifiedPartner?.name || "", commentaires: "", confirmDocuments: false });
      setMedioDocuments([]);
      handleBackToSelection();
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || t('depositContract.cannotSubmit'), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBusiness = async () => {
    if (!businessForm.entrepriseNom || !businessForm.chefNom || !businessForm.emailRetour) {
      toast({ title: t('common.error'), description: t('depositContract.fillRequired'), variant: "destructive" });
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
      toast({ title: t('depositContract.formSent', { type: 'BUSINESS' }), description: t('depositContract.requestSubmitted') });
      setBusinessForm({ entrepriseNom: "", entrepriseActivite: "", formeSociete: "", nouvelleCreation: "", entrepriseAdresse: "", chefCivilite: "", chefPrenom: "", chefNom: "", chefDateNaissance: "", chefAdresse: "", chefNationalite: "", chefPermis: "", rcEntreprise: false, rcAssureurPrecedent: "", rcTypeContrat: "", rcChiffreAffaire: "", rcSommeAssurance: "3000000", rcFranchise: "500", assuranceChoses: false, chosesIncendie: false, chosesIncendieMontant: "", chosesVol: false, chosesVolMontant: "", chosesDegatsEau: false, chosesDegatsEauMontant: "", laaObligatoire: false, laaComplementaire: false, nombreFemmes: "", ageMoyenFemmes: "", salairesFemmes: "", nombreHommes: "", ageMoyenHommes: "", salairesHommes: "", perteGainMaladie: false, compagnies: [], dateEffet: "", dateRdv: "", emailRetour: "", langue: "fr", commentaires: "" });
      setBusinessDocuments([]);
      handleBackToSelection();
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || t('depositContract.cannotSubmit'), variant: "destructive" });
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
                {t('common.back')}
              </Button>
              <ThemeToggle />
            </div>
            <div className="flex justify-center">
              <img src={tenantLogo} alt={tenantName} className="h-12 max-w-[200px] object-contain" />
            </div>
            <div>
              <CardTitle>{t('depositContract.title')}</CardTitle>
              <CardDescription>{t('depositContract.enterCollaboratorEmail')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partner-email">{t('depositContract.collaboratorEmail')}</Label>
              <Input id="partner-email" type="email" placeholder={t('depositContract.emailPlaceholder')} value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleVerifyEmail()} />
            </div>
            <Button className="w-full" onClick={handleVerifyEmail} disabled={verifying} style={tenantPrimaryColor ? { backgroundColor: tenantPrimaryColor } : undefined}>
              {verifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('depositContract.verifying')}</> : <><Mail className="mr-2 h-4 w-4" />{t('depositContract.accessForm')}</>}
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
              <Button variant="outline" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />{t('clientSpace.logout')}</Button>
            </div>
          </div>
        </header>
        <main className="container py-12 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">{t('depositContract.title')}</h1>
            <p className="text-muted-foreground">{t('depositContract.selectFormType')}</p>
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
            <Button variant="outline" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />{t('clientSpace.logout')}</Button>
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
                  <span className="block">{t('depositContract.sana.formTitle')}</span>
                  <span className="text-sm font-normal text-muted-foreground">{t('depositContract.sana.formSubtitle')}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* IA SCAN Section */}
              {sanaScanResults ? (
                <IAScanValidation
                  results={sanaScanResults}
                  onValidate={handleSanaScanValidate}
                  onCancel={() => setSanaScanResults(null)}
                  primaryColor={tenantPrimaryColor || undefined}
                />
              ) : (
                <IAScanUpload
                  formType="sana"
                  tenantId={tenant?.id}
                  onScanComplete={(results) => setSanaScanResults(results)}
                  primaryColor={tenantPrimaryColor || undefined}
                />
              )}

              {/* Client info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">{t('depositContract.common.clientInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.lastName')} *</Label>
                    <Input value={sanaForm.clientNom} onChange={(e) => setSanaForm(prev => ({ ...prev, clientNom: e.target.value }))} placeholder={t('depositContract.common.lastNamePlaceholder')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.firstName')} *</Label>
                    <Input value={sanaForm.clientPrenom} onChange={(e) => setSanaForm(prev => ({ ...prev, clientPrenom: e.target.value }))} placeholder={t('depositContract.common.firstNamePlaceholder')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.email')} *</Label>
                    <Input type="email" value={sanaForm.clientEmail} onChange={(e) => setSanaForm(prev => ({ ...prev, clientEmail: e.target.value }))} placeholder="email@exemple.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.phone')} *</Label>
                    <Input value={sanaForm.clientTel} onChange={(e) => setSanaForm(prev => ({ ...prev, clientTel: e.target.value }))} placeholder="+41 79 000 00 00" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.birthDate')}</Label>
                    <Input type="date" value={sanaForm.dateNaissance} onChange={(e) => setSanaForm(prev => ({ ...prev, dateNaissance: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.sana.currentInsurer')}</Label>
                    <Input value={sanaForm.assureurActuel} onChange={(e) => setSanaForm(prev => ({ ...prev, assureurActuel: e.target.value }))} placeholder={t('depositContract.sana.currentInsurerPlaceholder')} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t('depositContract.common.address')}</Label>
                    <Input value={sanaForm.adresse} onChange={(e) => setSanaForm(prev => ({ ...prev, adresse: e.target.value }))} placeholder={t('depositContract.common.streetPlaceholder')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.postalCode')}</Label>
                    <Input value={sanaForm.npa} onChange={(e) => setSanaForm(prev => ({ ...prev, npa: e.target.value }))} placeholder="1000" />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>{t('depositContract.common.city')}</Label>
                    <Input value={sanaForm.localite} onChange={(e) => setSanaForm(prev => ({ ...prev, localite: e.target.value }))} placeholder={t('depositContract.common.cityPlaceholder')} />
                  </div>
                </div>
              </div>

              {/* LAMal/LCA details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">{t('depositContract.sana.lamalLcaDetails')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t('depositContract.sana.lamalEffectDate')}</Label>
                    <Input type="date" value={sanaForm.lamalDateEffet} onChange={(e) => setSanaForm(prev => ({ ...prev, lamalDateEffet: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.sana.lcaEffectDate')}</Label>
                    <Input type="date" value={sanaForm.lcaDateEffet} onChange={(e) => setSanaForm(prev => ({ ...prev, lcaDateEffet: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.sana.lcaProduction')}</Label>
                    <Input type="number" value={sanaForm.lcaProduction} onChange={(e) => setSanaForm(prev => ({ ...prev, lcaProduction: e.target.value }))} placeholder="0.00" />
                  </div>
                </div>
              </div>

              {/* Agent */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('depositContract.common.agentName')}</Label>
                  <Input value={sanaForm.agentName} onChange={(e) => setSanaForm(prev => ({ ...prev, agentName: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('depositContract.common.comments')}</Label>
                <Textarea value={sanaForm.commentaires} onChange={(e) => setSanaForm(prev => ({ ...prev, commentaires: e.target.value }))} placeholder={t('depositContract.common.additionalInfo')} rows={3} />
              </div>

              {/* Documents */}
              <div className="space-y-4 p-4 border-2 rounded-lg" style={{ borderColor: tenantPrimaryColor || 'hsl(var(--primary)/0.3)', backgroundColor: tenantPrimaryColor ? `${tenantPrimaryColor}08` : 'hsl(var(--primary)/0.05)' }}>
                <div className="flex items-center gap-2" style={{ color: tenantPrimaryColor || 'hsl(var(--primary))' }}>
                  <FileText className="h-5 w-5" />
                  <h3 className="font-semibold">{t('depositContract.common.documentsToProvide')}</h3>
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
                  <Label htmlFor="sana-confirm" className="font-medium cursor-pointer">{t('depositContract.common.confirmUpload')}</Label>
                  <p className="text-sm text-muted-foreground">{t('depositContract.common.documentsAdded', { count: sanaDocuments.filter(Boolean).length })}</p>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleSubmitSana} disabled={submitting} style={tenantPrimaryColor ? { backgroundColor: tenantPrimaryColor } : undefined}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('depositContract.common.sending')}</> : <><Upload className="mr-2 h-4 w-4" />{t('depositContract.common.submitForm', { type: 'SANA' })}</>}
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
                  <span className="block">{t('depositContract.vita.formTitle')}</span>
                  <span className="text-sm font-normal text-muted-foreground">{t('depositContract.vita.formSubtitle')}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* IA SCAN Section */}
              {vitaScanResults ? (
                <IAScanValidation
                  results={vitaScanResults}
                  onValidate={handleVitaScanValidate}
                  onCancel={() => setVitaScanResults(null)}
                  primaryColor={tenantPrimaryColor || undefined}
                />
              ) : (
                <IAScanUpload
                  formType="vita"
                  tenantId={tenant?.id}
                  onScanComplete={(results) => setVitaScanResults(results)}
                  primaryColor={tenantPrimaryColor || undefined}
                />
              )}

              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">{t('depositContract.common.clientInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.lastName')} *</Label>
                    <Input value={vitaForm.clientNom} onChange={(e) => setVitaForm(prev => ({ ...prev, clientNom: e.target.value }))} placeholder={t('depositContract.common.lastNamePlaceholder')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.firstName')} *</Label>
                    <Input value={vitaForm.clientPrenom} onChange={(e) => setVitaForm(prev => ({ ...prev, clientPrenom: e.target.value }))} placeholder={t('depositContract.common.firstNamePlaceholder')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.email')} *</Label>
                    <Input type="email" value={vitaForm.clientEmail} onChange={(e) => setVitaForm(prev => ({ ...prev, clientEmail: e.target.value }))} placeholder="email@exemple.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.phone')} *</Label>
                    <Input value={vitaForm.clientTel} onChange={(e) => setVitaForm(prev => ({ ...prev, clientTel: e.target.value }))} placeholder="+41 79 000 00 00" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">{t('depositContract.vita.contractDetails')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.effectDate')}</Label>
                    <Input type="date" value={vitaForm.vitaDateEffet} onChange={(e) => setVitaForm(prev => ({ ...prev, vitaDateEffet: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.vita.contractDuration')}</Label>
                    <Select value={vitaForm.vitaDureeContrat} onValueChange={(v) => setVitaForm(prev => ({ ...prev, vitaDureeContrat: v }))}>
                      <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">{t('depositContract.vita.years', { count: 5 })}</SelectItem>
                        <SelectItem value="10">{t('depositContract.vita.years', { count: 10 })}</SelectItem>
                        <SelectItem value="15">{t('depositContract.vita.years', { count: 15 })}</SelectItem>
                        <SelectItem value="20">{t('depositContract.vita.years', { count: 20 })}</SelectItem>
                        <SelectItem value="25">{t('depositContract.vita.years', { count: 25 })}</SelectItem>
                        <SelectItem value="30">{t('depositContract.vita.years', { count: 30 })}</SelectItem>
                        <SelectItem value="retraite">{t('depositContract.vita.untilRetirement')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.vita.monthlyPremium')}</Label>
                    <Input type="number" value={vitaForm.vitaPrimeMensuelle} onChange={(e) => setVitaForm(prev => ({ ...prev, vitaPrimeMensuelle: e.target.value }))} placeholder={t('depositContract.vita.divideByTwelve')} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('depositContract.common.agentName')}</Label>
                <Input value={vitaForm.agentName} onChange={(e) => setVitaForm(prev => ({ ...prev, agentName: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label>{t('depositContract.common.comments')}</Label>
                <Textarea value={vitaForm.commentaires} onChange={(e) => setVitaForm(prev => ({ ...prev, commentaires: e.target.value }))} placeholder={t('depositContract.common.additionalInfo')} rows={3} />
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">⚠️ {t('depositContract.vita.requiredDocsTitle')}</p>
                <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 space-y-1">
                  <li><strong>{t('depositContract.vita.docProposal')}</strong></li>
                  <li>{t('depositContract.vita.docIdentity')}</li>
                  <li>{t('depositContract.vita.docAdequacy')}</li>
                  <li>{t('depositContract.vita.docDirectDebit')}</li>
                  <li><strong>{t('depositContract.vita.docMinutes')}</strong></li>
                </ul>
              </div>

              <div className="space-y-4 p-4 border-2 rounded-lg" style={{ borderColor: tenantPrimaryColor || 'hsl(var(--primary)/0.3)', backgroundColor: tenantPrimaryColor ? `${tenantPrimaryColor}08` : 'hsl(var(--primary)/0.05)' }}>
                <div className="flex items-center gap-2" style={{ color: tenantPrimaryColor || 'hsl(var(--primary))' }}>
                  <FileText className="h-5 w-5" />
                  <h3 className="font-semibold">{t('depositContract.common.documentsToProvide')}</h3>
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
                  <Label htmlFor="vita-confirm" className="font-medium cursor-pointer">{t('depositContract.common.confirmUpload')}</Label>
                  <p className="text-sm text-muted-foreground">{t('depositContract.common.documentsAdded', { count: vitaDocuments.filter(Boolean).length })}</p>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleSubmitVita} disabled={submitting} style={tenantPrimaryColor ? { backgroundColor: tenantPrimaryColor } : undefined}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('depositContract.common.sending')}</> : <><Upload className="mr-2 h-4 w-4" />{t('depositContract.common.submitForm', { type: 'VITA' })}</>}
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
                  <span className="block">{t('depositContract.medio.formTitle')}</span>
                  <span className="text-sm font-normal text-muted-foreground">{t('depositContract.medio.formSubtitle')}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* IA SCAN Section */}
              {medioScanResults ? (
                <IAScanValidation
                  results={medioScanResults}
                  onValidate={handleMedioScanValidate}
                  onCancel={() => setMedioScanResults(null)}
                  primaryColor={tenantPrimaryColor || undefined}
                />
              ) : (
                <IAScanUpload
                  formType="medio"
                  tenantId={tenant?.id}
                  onScanComplete={(results) => setMedioScanResults(results)}
                  primaryColor={tenantPrimaryColor || undefined}
                />
              )}

              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">{t('depositContract.medio.policyholderInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.lastName')} *</Label>
                    <Input value={medioForm.preneurNom} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurNom: e.target.value }))} placeholder={t('depositContract.common.lastNamePlaceholder')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.firstName')} *</Label>
                    <Input value={medioForm.preneurPrenom} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurPrenom: e.target.value }))} placeholder={t('depositContract.common.firstNamePlaceholder')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.email')} *</Label>
                    <Input type="email" value={medioForm.preneurEmail} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurEmail: e.target.value }))} placeholder="email@exemple.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.phone')} *</Label>
                    <Input value={medioForm.preneurTel} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurTel: e.target.value }))} placeholder="+41 79 000 00 00" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t('depositContract.common.address')}</Label>
                    <Input value={medioForm.preneurAdresse} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurAdresse: e.target.value }))} placeholder={t('depositContract.common.streetPlaceholder')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.postalCode')}</Label>
                    <Input value={medioForm.preneurNpa} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurNpa: e.target.value }))} placeholder="1000" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.city')}</Label>
                    <Input value={medioForm.preneurLocalite} onChange={(e) => setMedioForm(prev => ({ ...prev, preneurLocalite: e.target.value }))} placeholder={t('depositContract.common.cityPlaceholder')} />
                  </div>
                </div>
              </div>

              {/* RC Privée */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox checked={medioForm.rcPrivee} onCheckedChange={(c) => setMedioForm(prev => ({ ...prev, rcPrivee: c as boolean }))} id="rc-privee" />
                  <Label htmlFor="rc-privee" className="font-semibold text-lg cursor-pointer">{t('depositContract.medio.rcPrivate')}</Label>
                </div>
                {medioForm.rcPrivee && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label>{t('depositContract.common.insuredSum')}</Label>
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
                  <Label htmlFor="menage" className="font-semibold text-lg cursor-pointer">{t('depositContract.medio.household')}</Label>
                </div>
                {medioForm.menage && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label>{t('depositContract.medio.furnitureValue')}</Label>
                      <Input type="number" value={medioForm.menageMontant} onChange={(e) => setMedioForm(prev => ({ ...prev, menageMontant: e.target.value }))} placeholder="50000" />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <Checkbox checked={medioForm.menageVol} onCheckedChange={(c) => setMedioForm(prev => ({ ...prev, menageVol: c as boolean }))} id="menage-vol" />
                      <Label htmlFor="menage-vol" className="cursor-pointer">{t('depositContract.medio.includeTheft')}</Label>
                    </div>
                  </div>
                )}
              </div>

              {/* Auto */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox checked={medioForm.auto} onCheckedChange={(c) => setMedioForm(prev => ({ ...prev, auto: c as boolean }))} id="auto" />
                  <Label htmlFor="auto" className="font-semibold text-lg cursor-pointer flex items-center gap-2"><Car className="h-5 w-5" /> {t('depositContract.medio.autoInsurance')}</Label>
                </div>
                {medioForm.auto && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label>{t('depositContract.medio.brand')}</Label>
                      <Input value={medioForm.marqueVehicule} onChange={(e) => setMedioForm(prev => ({ ...prev, marqueVehicule: e.target.value }))} placeholder="Ex: Volkswagen" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('depositContract.medio.model')}</Label>
                      <Input value={medioForm.modeleVehicule} onChange={(e) => setMedioForm(prev => ({ ...prev, modeleVehicule: e.target.value }))} placeholder="Ex: Golf" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('depositContract.medio.year')}</Label>
                      <Input value={medioForm.anneeVehicule} onChange={(e) => setMedioForm(prev => ({ ...prev, anneeVehicule: e.target.value }))} placeholder="2020" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('depositContract.medio.licensePlate')}</Label>
                      <Input value={medioForm.plaqueVehicule} onChange={(e) => setMedioForm(prev => ({ ...prev, plaqueVehicule: e.target.value }))} placeholder="GE 123456" />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('depositContract.common.desiredEffectDate')}</Label>
                  <Input type="date" value={medioForm.dateEffet} onChange={(e) => setMedioForm(prev => ({ ...prev, dateEffet: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('depositContract.common.agentName')}</Label>
                  <Input value={medioForm.agentName} onChange={(e) => setMedioForm(prev => ({ ...prev, agentName: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('depositContract.common.comments')}</Label>
                <Textarea value={medioForm.commentaires} onChange={(e) => setMedioForm(prev => ({ ...prev, commentaires: e.target.value }))} placeholder={t('depositContract.medio.commentsPlaceholder')} rows={3} />
              </div>

              <div className="space-y-4 p-4 border-2 rounded-lg" style={{ borderColor: tenantPrimaryColor || 'hsl(var(--primary)/0.3)', backgroundColor: tenantPrimaryColor ? `${tenantPrimaryColor}08` : 'hsl(var(--primary)/0.05)' }}>
                <div className="flex items-center gap-2" style={{ color: tenantPrimaryColor || 'hsl(var(--primary))' }}>
                  <FileText className="h-5 w-5" />
                  <h3 className="font-semibold">{t('depositContract.common.documentsToProvide')}</h3>
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
                  <Label htmlFor="medio-confirm" className="font-medium cursor-pointer">{t('depositContract.common.confirmUpload')}</Label>
                  <p className="text-sm text-muted-foreground">{t('depositContract.common.documentsAdded', { count: medioDocuments.filter(Boolean).length })}</p>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleSubmitMedio} disabled={submitting} style={tenantPrimaryColor ? { backgroundColor: tenantPrimaryColor } : undefined}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('depositContract.common.sending')}</> : <><Upload className="mr-2 h-4 w-4" />{t('depositContract.common.submitForm', { type: 'MEDIO' })}</>}
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
                  <span className="block">{t('depositContract.business.formTitle')}</span>
                  <span className="text-sm font-normal text-muted-foreground">{t('depositContract.business.formSubtitle')}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* IA SCAN Section */}
              {businessScanResults ? (
                <IAScanValidation
                  results={businessScanResults}
                  onValidate={handleBusinessScanValidate}
                  onCancel={() => setBusinessScanResults(null)}
                  primaryColor={tenantPrimaryColor || undefined}
                />
              ) : (
                <IAScanUpload
                  formType="business"
                  tenantId={tenant?.id}
                  onScanComplete={(results) => setBusinessScanResults(results)}
                  primaryColor={tenantPrimaryColor || undefined}
                />
              )}

              {/* Renseignements généraux */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2"><Building2 className="h-5 w-5" /> {t('depositContract.business.generalInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('depositContract.business.companyName')} *</Label>
                    <Input value={businessForm.entrepriseNom} onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseNom: e.target.value }))} placeholder={t('depositContract.business.companyNamePlaceholder')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.business.activity')} *</Label>
                    <Input value={businessForm.entrepriseActivite} onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseActivite: e.target.value }))} placeholder={t('depositContract.business.activityPlaceholder')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.business.legalForm')} *</Label>
                    <Select value={businessForm.formeSociete} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, formeSociete: v }))}>
                      <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sa">SA</SelectItem>
                        <SelectItem value="sarl">Sàrl</SelectItem>
                        <SelectItem value="snc">{t('depositContract.business.snc')}</SelectItem>
                        <SelectItem value="ri">{t('depositContract.business.ri')}</SelectItem>
                        <SelectItem value="association">{t('depositContract.business.association')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.business.newCreation')} *</Label>
                    <RadioGroup value={businessForm.nouvelleCreation} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, nouvelleCreation: v }))} className="flex gap-4 pt-2">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="oui" id="nc-oui" /><Label htmlFor="nc-oui">{t('common.yes')}</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="non" id="nc-non" /><Label htmlFor="nc-non">{t('common.no')}</Label></div>
                    </RadioGroup>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('depositContract.business.companyAddress')} *</Label>
                  <Textarea value={businessForm.entrepriseAdresse} onChange={(e) => setBusinessForm(prev => ({ ...prev, entrepriseAdresse: e.target.value }))} placeholder={t('depositContract.common.fullAddress')} rows={2} />
                </div>
              </div>

              {/* Chef d'entreprise */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2"><User className="h-5 w-5" /> {t('depositContract.business.ceo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t('depositContract.business.title')} *</Label>
                    <Select value={businessForm.chefCivilite} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, chefCivilite: v }))}>
                      <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="m">{t('common.mr')}</SelectItem>
                        <SelectItem value="mme">{t('common.mrs')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.firstName')} *</Label>
                    <Input value={businessForm.chefPrenom} onChange={(e) => setBusinessForm(prev => ({ ...prev, chefPrenom: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.lastName')} *</Label>
                    <Input value={businessForm.chefNom} onChange={(e) => setBusinessForm(prev => ({ ...prev, chefNom: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.birthDate')}</Label>
                    <Input type="date" value={businessForm.chefDateNaissance} onChange={(e) => setBusinessForm(prev => ({ ...prev, chefDateNaissance: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.business.nationality')} *</Label>
                    <Input value={businessForm.chefNationalite} onChange={(e) => setBusinessForm(prev => ({ ...prev, chefNationalite: e.target.value }))} placeholder={t('depositContract.business.swiss')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.business.permit')} *</Label>
                    <Select value={businessForm.chefPermis} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, chefPermis: v }))}>
                      <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="suisse">{t('depositContract.business.swissCitizen')}</SelectItem>
                        <SelectItem value="c">{t('depositContract.business.permitC')}</SelectItem>
                        <SelectItem value="b">{t('depositContract.business.permitB')}</SelectItem>
                        <SelectItem value="g">{t('depositContract.business.permitG')}</SelectItem>
                        <SelectItem value="l">{t('depositContract.business.permitL')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('depositContract.business.ceoAddress')} *</Label>
                  <Input value={businessForm.chefAdresse} onChange={(e) => setBusinessForm(prev => ({ ...prev, chefAdresse: e.target.value }))} placeholder={t('depositContract.common.fullAddress')} />
                </div>
              </div>

              {/* RC Entreprise */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Checkbox checked={businessForm.rcEntreprise} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, rcEntreprise: c as boolean }))} id="rc-entreprise" />
                  <Label htmlFor="rc-entreprise" className="font-semibold text-lg cursor-pointer text-purple-700 dark:text-purple-300">{t('depositContract.business.rcBusiness')}</Label>
                </div>
                {businessForm.rcEntreprise && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('depositContract.business.previousInsurer')}</Label>
                        <RadioGroup value={businessForm.rcAssureurPrecedent} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, rcAssureurPrecedent: v }))} className="flex gap-4">
                          <div className="flex items-center space-x-2"><RadioGroupItem value="oui" id="rca-oui" /><Label htmlFor="rca-oui">{t('common.yes')}</Label></div>
                          <div className="flex items-center space-x-2"><RadioGroupItem value="non" id="rca-non" /><Label htmlFor="rca-non">{t('common.no')}</Label></div>
                        </RadioGroup>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('depositContract.business.rcContractType')}</Label>
                        <Select value={businessForm.rcTypeContrat} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, rcTypeContrat: v }))}>
                          <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="base">{t('depositContract.business.rcBase')}</SelectItem>
                            <SelectItem value="specifique">{t('depositContract.business.rcSpecific')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('depositContract.business.turnover')}</Label>
                        <Input type="number" value={businessForm.rcChiffreAffaire} onChange={(e) => setBusinessForm(prev => ({ ...prev, rcChiffreAffaire: e.target.value }))} placeholder="500000" />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('depositContract.common.insuredSum')}</Label>
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
                        <Label>{t('depositContract.business.deductible')}</Label>
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
                  <Label htmlFor="assurance-choses" className="font-semibold text-lg cursor-pointer text-purple-700 dark:text-purple-300">{t('depositContract.business.propertyInsurance')}</Label>
                </div>
                {businessForm.assuranceChoses && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={businessForm.chosesIncendie} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, chosesIncendie: c as boolean }))} id="choses-incendie" />
                        <Label htmlFor="choses-incendie" className="cursor-pointer">{t('depositContract.business.fire')}</Label>
                      </div>
                      {businessForm.chosesIncendie && (
                        <div className="space-y-2 md:col-span-2">
                          <Input type="number" value={businessForm.chosesIncendieMontant} onChange={(e) => setBusinessForm(prev => ({ ...prev, chosesIncendieMontant: e.target.value }))} placeholder={t('depositContract.business.totalValuePlaceholder')} />
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={businessForm.chosesVol} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, chosesVol: c as boolean }))} id="choses-vol" />
                        <Label htmlFor="choses-vol" className="cursor-pointer">{t('depositContract.business.theft')}</Label>
                      </div>
                      {businessForm.chosesVol && (
                        <div className="space-y-2 md:col-span-2">
                          <Input type="number" value={businessForm.chosesVolMontant} onChange={(e) => setBusinessForm(prev => ({ ...prev, chosesVolMontant: e.target.value }))} placeholder={t('depositContract.business.insuredSumPlaceholder')} />
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={businessForm.chosesDegatsEau} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, chosesDegatsEau: c as boolean }))} id="choses-eau" />
                        <Label htmlFor="choses-eau" className="cursor-pointer">{t('depositContract.business.waterDamage')}</Label>
                      </div>
                      {businessForm.chosesDegatsEau && (
                        <div className="space-y-2 md:col-span-2">
                          <Input type="number" value={businessForm.chosesDegatsEauMontant} onChange={(e) => setBusinessForm(prev => ({ ...prev, chosesDegatsEauMontant: e.target.value }))} placeholder={t('depositContract.business.totalValuePlaceholder')} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* LAA */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h4 className="font-semibold text-purple-700 dark:text-purple-300">{t('depositContract.business.employeeInsurance')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={businessForm.laaObligatoire} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, laaObligatoire: c as boolean }))} id="laa-oblig" />
                    <Label htmlFor="laa-oblig" className="cursor-pointer">{t('depositContract.business.laaObligatory')}</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox checked={businessForm.laaComplementaire} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, laaComplementaire: c as boolean }))} id="laa-comp" />
                    <Label htmlFor="laa-comp" className="cursor-pointer">{t('depositContract.business.laaSupplementary')}</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox checked={businessForm.perteGainMaladie} onCheckedChange={(c) => setBusinessForm(prev => ({ ...prev, perteGainMaladie: c as boolean }))} id="pgm" />
                    <Label htmlFor="pgm" className="cursor-pointer">{t('depositContract.business.lossOfEarnings')}</Label>
                  </div>
                </div>
                {(businessForm.laaObligatoire || businessForm.laaComplementaire || businessForm.perteGainMaladie) && (
                  <div className="space-y-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">{t('depositContract.business.staffCount')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{t('depositContract.business.womenCount')}</Label>
                        <Input type="number" value={businessForm.nombreFemmes} onChange={(e) => setBusinessForm(prev => ({ ...prev, nombreFemmes: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('depositContract.business.womenAvgAge')}</Label>
                        <Input type="number" value={businessForm.ageMoyenFemmes} onChange={(e) => setBusinessForm(prev => ({ ...prev, ageMoyenFemmes: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('depositContract.business.womenSalaries')}</Label>
                        <Input type="number" value={businessForm.salairesFemmes} onChange={(e) => setBusinessForm(prev => ({ ...prev, salairesFemmes: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('depositContract.business.menCount')}</Label>
                        <Input type="number" value={businessForm.nombreHommes} onChange={(e) => setBusinessForm(prev => ({ ...prev, nombreHommes: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('depositContract.business.menAvgAge')}</Label>
                        <Input type="number" value={businessForm.ageMoyenHommes} onChange={(e) => setBusinessForm(prev => ({ ...prev, ageMoyenHommes: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('depositContract.business.menSalaries')}</Label>
                        <Input type="number" value={businessForm.salairesHommes} onChange={(e) => setBusinessForm(prev => ({ ...prev, salairesHommes: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Finalisation */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">{t('depositContract.business.finalization')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('depositContract.common.desiredEffectDate')} *</Label>
                    <Input type="date" value={businessForm.dateEffet} onChange={(e) => setBusinessForm(prev => ({ ...prev, dateEffet: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.business.nextMeeting')}</Label>
                    <Input type="date" value={businessForm.dateRdv} onChange={(e) => setBusinessForm(prev => ({ ...prev, dateRdv: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.business.returnEmail')} *</Label>
                    <Input type="email" value={businessForm.emailRetour} onChange={(e) => setBusinessForm(prev => ({ ...prev, emailRetour: e.target.value }))} placeholder="email@entreprise.ch" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('depositContract.business.offerLanguage')}</Label>
                    <Select value={businessForm.langue} onValueChange={(v) => setBusinessForm(prev => ({ ...prev, langue: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fr">{t('common.french')}</SelectItem>
                        <SelectItem value="de">{t('common.german')}</SelectItem>
                        <SelectItem value="it">{t('common.italian')}</SelectItem>
                        <SelectItem value="en">{t('common.english')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('depositContract.common.comments')}</Label>
                  <Textarea value={businessForm.commentaires} onChange={(e) => setBusinessForm(prev => ({ ...prev, commentaires: e.target.value }))} placeholder={t('depositContract.business.commentsPlaceholder')} rows={4} />
                </div>
              </div>

              {/* Documents */}
              <div className="space-y-4 p-4 border-2 rounded-lg" style={{ borderColor: tenantPrimaryColor || 'hsl(var(--primary)/0.3)', backgroundColor: tenantPrimaryColor ? `${tenantPrimaryColor}08` : 'hsl(var(--primary)/0.05)' }}>
                <div className="flex items-center gap-2" style={{ color: tenantPrimaryColor || 'hsl(var(--primary))' }}>
                  <FileText className="h-5 w-5" />
                  <h3 className="font-semibold">{t('depositContract.common.documentsToProvide')}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{t('depositContract.business.zefixNote')} <a href="http://zefix.admin.ch/" target="_blank" rel="noopener noreferrer" className="text-primary underline">zefix.admin.ch</a></p>
                <div className="space-y-3">
                  {businessRequiredDocs.map((doc, i) => (
                    <SingleDocumentUpload key={i} label={doc} docKind={`business_doc_${i}`} onUpload={(d) => setBusinessDocuments(prev => { const n = [...prev]; n[i] = d; return n; })} onRemove={() => setBusinessDocuments(prev => prev.filter((_, idx) => idx !== i))} uploadedDocument={businessDocuments[i] || null} required={i < 2} primaryColor={tenantPrimaryColor || undefined} />
                  ))}
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleSubmitBusiness} disabled={submitting} style={tenantPrimaryColor ? { backgroundColor: tenantPrimaryColor } : undefined}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('depositContract.common.sending')}</> : <><Upload className="mr-2 h-4 w-4" />{t('depositContract.common.submitForm', { type: 'BUSINESS' })}</>}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
