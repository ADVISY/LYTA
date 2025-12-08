import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, FileCheck, Send, Upload, X, Heart, Shield, Building2, Stethoscope } from "lucide-react";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import advisyLogo from "@/assets/advisy-logo.svg";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

type FormType = "SANA" | "VITA" | "MEDIO" | "BUSINESS" | null;
type Step = "email" | "selectType" | "form";

interface DocumentFile {
  file: File;
  type: string;
}

const FORM_TYPES = [
  { id: "SANA" as FormType, label: "SANA", description: "Assurance maladie LAMal/LCA", icon: Heart, color: "text-red-500" },
  { id: "VITA" as FormType, label: "VITA", description: "Prévoyance vie / 3e pilier", icon: Shield, color: "text-blue-500" },
  { id: "MEDIO" as FormType, label: "MEDIO", description: "Complémentaire santé", icon: Stethoscope, color: "text-green-500" },
  { id: "BUSINESS" as FormType, label: "BUSINESS", description: "Assurances entreprise", icon: Building2, color: "text-purple-500" },
];

const PartnerContractSubmit = () => {
  const [step, setStep] = useState<Step>("email");
  const [formType, setFormType] = useState<FormType>(null);
  const [email, setEmail] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  
  // Common client fields
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [agentName, setAgentName] = useState("");
  const [comments, setComments] = useState("");
  
  // SANA specific fields
  const [lamalEffectDate, setLamalEffectDate] = useState("");
  const [lcaEffectDate, setLcaEffectDate] = useState("");
  const [lcaProduction, setLcaProduction] = useState("");
  
  // VITA specific fields
  const [vitaEffectDate, setVitaEffectDate] = useState("");
  const [vitaDuration, setVitaDuration] = useState("");
  const [vitaMonthlyPremium, setVitaMonthlyPremium] = useState("");
  
  // MEDIO specific fields
  const [medioEffectDate, setMedioEffectDate] = useState("");
  const [medioProduction, setMedioProduction] = useState("");
  
  // BUSINESS specific fields
  const [companyName, setCompanyName] = useState("");
  const [companyActivity, setCompanyActivity] = useState("");
  const [companyForm, setCompanyForm] = useState("");
  const [isNewCompany, setIsNewCompany] = useState(false);
  const [companyAddress, setCompanyAddress] = useState("");
  const [ceoFirstName, setCeoFirstName] = useState("");
  const [ceoLastName, setCeoLastName] = useState("");
  const [ceoGender, setCeoGender] = useState("");
  const [ceoBirthDate, setCeoBirthDate] = useState("");
  const [ceoAddress, setCeoAddress] = useState("");
  const [ceoNationality, setCeoNationality] = useState("");
  const [ceoPermit, setCeoPermit] = useState("");
  const [wantsRC, setWantsRC] = useState(false);
  const [rcType, setRcType] = useState("");
  const [rcRevenue, setRcRevenue] = useState("");
  
  // Documents
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Confirmation checkboxes
  const [confirmDocuments, setConfirmDocuments] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();

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
      const response = await supabase.functions.invoke('verify-partner-email', {
        body: { email: email.trim().toLowerCase() }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erreur de vérification');
      }

      const result = response.data;

      if (result.success && result.partner) {
        setPartnerId(result.partner.id);
        setPartnerName(result.partner.name);
        setAgentName(`${result.partner.firstName || ''} ${result.partner.lastName || ''}`.trim());
        setStep("selectType");
        toast({
          title: "Email vérifié",
          description: `Bienvenue ${result.partner.name}`,
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newDocs = Array.from(files).map(file => ({ file, type: docType }));
      setDocuments(prev => [...prev, ...newDocs]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitContract = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientFirstName || !clientLastName || !agentName) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    if (!confirmDocuments) {
      toast({
        title: "Confirmation requise",
        description: "Veuillez confirmer avoir téléchargé les documents requis.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          first_name: clientFirstName,
          last_name: clientLastName,
          email: clientEmail || null,
          mobile: clientPhone || null,
          type_adresse: 'client',
          status: 'prospect',
          company_name: formType === "BUSINESS" ? companyName : null,
          is_company: formType === "BUSINESS",
        })
        .select('id')
        .single();

      if (clientError) throw clientError;

      // Build form-specific data for notes
      let formData = `Type: ${formType}\nAgent: ${agentName}\n`;
      
      if (formType === "SANA") {
        formData += `LAMal Date d'effet: ${lamalEffectDate}\nLCA Date d'effet: ${lcaEffectDate}\nLCA Production: ${lcaProduction}`;
      } else if (formType === "VITA") {
        formData += `Date d'effet: ${vitaEffectDate}\nDurée: ${vitaDuration}\nPrime mensuelle: ${vitaMonthlyPremium}`;
      } else if (formType === "MEDIO") {
        formData += `Date d'effet: ${medioEffectDate}\nProduction: ${medioProduction}`;
      } else if (formType === "BUSINESS") {
        formData += `Entreprise: ${companyName}\nActivité: ${companyActivity}\nForme: ${companyForm}\nNouvelle: ${isNewCompany ? 'Oui' : 'Non'}`;
        if (wantsRC) formData += `\nRC Type: ${rcType}\nCA: ${rcRevenue}`;
      }
      
      if (comments) formData += `\nCommentaires: ${comments}`;

      // Create proposition
      const { error: propositionError } = await supabase
        .from('propositions')
        .insert({
          client_id: client.id,
          product_type: formType === "SANA" ? "health" : formType === "VITA" ? "life" : formType === "MEDIO" ? "health" : "business",
          monthly_premium: formType === "VITA" ? parseFloat(vitaMonthlyPremium) || null : null,
          status: 'pending',
        });

      if (propositionError) throw propositionError;

      // Upload documents
      for (const doc of documents) {
        const fileExt = doc.file.name.split('.').pop();
        const fileName = `${client.id}/${Date.now()}_${doc.type}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, doc.file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        await supabase.from('documents').insert({
          owner_id: client.id,
          owner_type: 'client',
          file_name: doc.file.name,
          file_key: fileName,
          doc_kind: doc.type,
          mime_type: doc.file.type,
          size_bytes: doc.file.size,
        });
      }

      toast({
        title: "Contrat déposé avec succès",
        description: "Votre proposition de contrat a été envoyée à Advisy pour traitement.",
      });

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

  const renderFormTypeSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
        <FileCheck className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">Partenaire: {partnerName}</span>
      </div>

      <h3 className="font-medium text-foreground text-center">Sélectionnez le type de formulaire</h3>
      
      <div className="grid grid-cols-2 gap-4">
        {FORM_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => {
              setFormType(type.id);
              setStep("form");
            }}
            className="p-6 border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left space-y-2"
          >
            <type.icon className={`h-8 w-8 ${type.color}`} />
            <h4 className="font-semibold text-foreground">{type.label}</h4>
            <p className="text-sm text-muted-foreground">{type.description}</p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setStep("email")}
        className="w-full text-sm text-muted-foreground hover:text-foreground text-center"
      >
        Changer de partenaire
      </button>
    </div>
  );

  const renderSanaForm = () => (
    <>
      <div className="space-y-4">
        <h3 className="font-medium text-foreground border-b pb-2">Dates d'effet</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>LAMal - Date d'effet</Label>
            <Input type="date" value={lamalEffectDate} onChange={(e) => setLamalEffectDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>LCA - Date d'effet</Label>
            <Input type="date" value={lcaEffectDate} onChange={(e) => setLcaEffectDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>LCA - Production (SANA)</Label>
          <Input value={lcaProduction} onChange={(e) => setLcaProduction(e.target.value)} placeholder="Montant de production LCA" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-foreground border-b pb-2">Documents requis</h3>
        <p className="text-sm text-muted-foreground">Vous pouvez ajouter plusieurs documents, regroupés PAR PERSONNE</p>
        
        <div className="grid grid-cols-2 gap-2">
          {["Proposition", "Ancienne police LAMal", "Ancienne police LCA", "Pièce d'identité", "Résiliation LAMal", "Résiliation LCA"].map((docType) => (
            <div key={docType} className="space-y-1">
              <Label className="text-xs">{docType}</Label>
              <Input 
                type="file" 
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => handleFileSelect(e, docType)}
                className="text-xs"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const renderVitaForm = () => (
    <>
      <div className="space-y-4">
        <h3 className="font-medium text-foreground border-b pb-2">Informations contrat VITA</h3>
        <div className="space-y-2">
          <Label>Vita - Date d'effet</Label>
          <Input type="date" value={vitaEffectDate} onChange={(e) => setVitaEffectDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Vita - Durée du contrat (années)</Label>
          <Input type="number" value={vitaDuration} onChange={(e) => setVitaDuration(e.target.value)} placeholder="Ex: 10" />
        </div>
        <div className="space-y-2">
          <Label>Vita - Prime mensuelle nette (CHF)</Label>
          <Input type="number" value={vitaMonthlyPremium} onChange={(e) => setVitaMonthlyPremium(e.target.value)} placeholder="Diviser par 12 si annuelle" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-foreground border-b pb-2">Documents requis</h3>
        <p className="text-sm text-muted-foreground">Si signé électroniquement, joindre les annexes et l'offre PDF</p>
        
        <div className="grid grid-cols-2 gap-2">
          {["Proposition", "Pièce d'identité", "Procès-verbal de conseil", "Documents supplémentaires"].map((docType) => (
            <div key={docType} className="space-y-1">
              <Label className="text-xs">{docType}</Label>
              <Input 
                type="file" 
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => handleFileSelect(e, docType)}
                className="text-xs"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const renderMedioForm = () => (
    <>
      <div className="space-y-4">
        <h3 className="font-medium text-foreground border-b pb-2">Informations contrat MEDIO</h3>
        <div className="space-y-2">
          <Label>Date d'effet</Label>
          <Input type="date" value={medioEffectDate} onChange={(e) => setMedioEffectDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Production (montant)</Label>
          <Input value={medioProduction} onChange={(e) => setMedioProduction(e.target.value)} placeholder="Montant de production" />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-foreground border-b pb-2">Documents requis</h3>
        
        <div className="grid grid-cols-2 gap-2">
          {["Proposition", "Ancienne police", "Pièce d'identité", "Résiliation", "Documents supplémentaires"].map((docType) => (
            <div key={docType} className="space-y-1">
              <Label className="text-xs">{docType}</Label>
              <Input 
                type="file" 
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => handleFileSelect(e, docType)}
                className="text-xs"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const renderBusinessForm = () => (
    <>
      <div className="space-y-4">
        <h3 className="font-medium text-foreground border-b pb-2">Renseignements généraux</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Nom de l'entreprise *</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Activité de l'entreprise *</Label>
            <Input value={companyActivity} onChange={(e) => setCompanyActivity(e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Forme de la Société *</Label>
            <Select value={companyForm} onValueChange={setCompanyForm}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sa">SA</SelectItem>
                <SelectItem value="sarl">Sàrl</SelectItem>
                <SelectItem value="snc">Société en Nom Collectif</SelectItem>
                <SelectItem value="ei">Entreprise Individuelle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nouvelle création *</Label>
            <Select value={isNewCompany ? "oui" : "non"} onValueChange={(v) => setIsNewCompany(v === "oui")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="oui">Oui</SelectItem>
                <SelectItem value="non">Non</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Adresse de l'entreprise *</Label>
          <Textarea value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} rows={2} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-foreground border-b pb-2">Chef d'entreprise</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Prénom *</Label>
            <Input value={ceoFirstName} onChange={(e) => setCeoFirstName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nom *</Label>
            <Input value={ceoLastName} onChange={(e) => setCeoLastName(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Civilité *</Label>
            <Select value={ceoGender} onValueChange={setCeoGender}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mme">Madame</SelectItem>
                <SelectItem value="m">Monsieur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date de naissance</Label>
            <Input type="date" value={ceoBirthDate} onChange={(e) => setCeoBirthDate(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Nationalité *</Label>
            <Input value={ceoNationality} onChange={(e) => setCeoNationality(e.target.value)} placeholder="Suisse" />
          </div>
          <div className="space-y-2">
            <Label>Permis de séjour *</Label>
            <Input value={ceoPermit} onChange={(e) => setCeoPermit(e.target.value)} placeholder="C, B, L..." />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-foreground border-b pb-2">Responsabilité Civile</h3>
        
        <div className="flex items-center space-x-2">
          <Checkbox checked={wantsRC} onCheckedChange={(c) => setWantsRC(!!c)} id="wantsRC" />
          <Label htmlFor="wantsRC">Souhaitez-vous une offre responsabilité civile ?</Label>
        </div>

        {wantsRC && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <div className="space-y-2">
              <Label>Type de contrat RC</Label>
              <Select value={rcType} onValueChange={setRcType}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">RC De Base (Bureau)</SelectItem>
                  <SelectItem value="specifique">RC Spécifique à l'activité</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chiffre d'affaire</Label>
              <Input value={rcRevenue} onChange={(e) => setRcRevenue(e.target.value)} placeholder="CHF" />
            </div>
          </div>
        )}
      </div>
    </>
  );

  const renderForm = () => (
    <form onSubmit={handleSubmitContract} className="space-y-6">
      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
        <FileCheck className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">Formulaire {formType} - {partnerName}</span>
        <button 
          type="button" 
          onClick={() => setStep("selectType")}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Changer
        </button>
      </div>

      {/* Common client info */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground border-b pb-2">Informations client</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="clientLastName">Nom *</Label>
            <Input id="clientLastName" value={clientLastName} onChange={(e) => setClientLastName(e.target.value)} placeholder="Nom du client" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientFirstName">Prénom *</Label>
            <Input id="clientFirstName" value={clientFirstName} onChange={(e) => setClientFirstName(e.target.value)} placeholder="Prénom du client" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="clientEmail">Email *</Label>
            <Input id="clientEmail" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@email.ch" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientPhone">Téléphone *</Label>
            <Input id="clientPhone" type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+41 79 123 45 67" required />
          </div>
        </div>
      </div>

      {/* Form-specific fields */}
      {formType === "SANA" && renderSanaForm()}
      {formType === "VITA" && renderVitaForm()}
      {formType === "MEDIO" && renderMedioForm()}
      {formType === "BUSINESS" && renderBusinessForm()}

      {/* Agent name */}
      <div className="space-y-2">
        <Label>Nom de l'agent Advisy *</Label>
        <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Votre nom complet" required />
      </div>

      {/* Comments */}
      <div className="space-y-2">
        <Label>Commentaires</Label>
        <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Informations complémentaires..." rows={3} />
      </div>

      {/* Uploaded documents list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <Label>Documents ajoutés ({documents.length})</Label>
          <div className="space-y-1">
            {documents.map((doc, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                <span className="truncate flex-1">{doc.type}: {doc.file.name}</span>
                <button type="button" onClick={() => removeDocument(idx)} className="text-destructive hover:text-destructive/80 p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation */}
      <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
        <div className="flex items-start space-x-2">
          <Checkbox checked={confirmDocuments} onCheckedChange={(c) => setConfirmDocuments(!!c)} id="confirm" />
          <Label htmlFor="confirm" className="text-sm leading-relaxed">
            Je confirme avoir téléchargé tous les documents requis: proposition avec déclaration de santé, copies des anciennes polices, pièces d'identité, et documents de résiliation si applicable.
          </Label>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
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
  );

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
          <img src={advisyLogo} alt="Advisy" className="h-20 sm:h-24 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Déposer un contrat
          </h1>
          <p className="text-muted-foreground">
            {step === "email" && "Identifiez-vous avec votre email partenaire"}
            {step === "selectType" && "Choisissez le type de formulaire"}
            {step === "form" && `Formulaire ${formType}`}
          </p>
        </div>

        <div className="max-w-2xl w-full bg-card rounded-lg shadow-lg border p-6 sm:p-8 animate-scale-in max-h-[80vh] overflow-y-auto">
          {step === "email" && (
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
              <Button type="submit" disabled={verifying} className="w-full mt-6">
                {verifying ? "Vérification..." : "Continuer"}
              </Button>
            </form>
          )}

          {step === "selectType" && renderFormTypeSelection()}
          {step === "form" && renderForm()}
        </div>
      </main>
    </div>
  );
};

export default PartnerContractSubmit;
