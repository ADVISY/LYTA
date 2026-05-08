// NOTE: Signature locale via canvas. Cible future: intégration e-sign provider (Yousign/DocuSign)
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Printer, FileCheck, Save, Loader2, Send } from "lucide-react";
import { format } from "date-fns";
import { fr, de, it, enUS } from "date-fns/locale";
import { Client } from "@/hooks/useClients";
import html2pdf from "html2pdf.js";
import SignaturePad from "./SignaturePad";
import { MandatTemplate, MandatTemplateData } from "@/components/signatures/MandatTemplate";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCrmEmails } from "@/hooks/useCrmEmails";
import { useDocuments } from "@/hooks/useDocuments";
import { useTenant } from "@/contexts/TenantContext";
import { useUserTenant } from "@/hooks/useUserTenant";
import { invokeSupabaseFunction } from "@/lib/edgeFunctions";
import { buildTenantLoginUrl } from "@/lib/tenantUrls";

interface MandatGestionFormProps {
  client: Client;
  onSaved?: () => void;
}

interface InsuranceInfo {
  rcMenage: string;
  auto: string;
  protectionJuridique: string;
  sante: string;
  vie3ePilier: string;
  autre: string;
}

const insuranceCompanies = [
  "Non",
  "Allianz Suisse",
  "AXA",
  "Baloise",
  "CSS",
  "Generali",
  "Groupe Mutuel",
  "Helsana",
  "Helvetia",
  "La Mobilière",
  "Sanitas",
  "Swica",
  "Swiss Life",
  "Sympany",
  "Vaudoise",
  "Visana",
  "Zurich",
  "Autre",
];

export default function MandatGestionForm({ client, onSaved }: MandatGestionFormProps) {
  const { t, i18n } = useTranslation();
  const { tenant } = useTenant();
  const [insurances, setInsurances] = useState<InsuranceInfo>({
    rcMenage: "Non",
    auto: "Non",
    protectionJuridique: "Non",
    sante: "Non",
    vie3ePilier: "Non",
    autre: "Non",
  });
  const [autreCompany, setAutreCompany] = useState("");
  const [lieu, setLieu] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [signatureAdvisy, setSignatureAdvisy] = useState<string | null>(null);
  const [signatureClient, setSignatureClient] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const mandatRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId } = useUserTenant();
  const { sendMandatSignedEmail } = useCrmEmails();
  const { createDocument } = useDocuments();

  // Get date-fns locale based on current language
  const getDateLocale = () => {
    const lang = i18n.language?.split('-')[0] || 'fr';
    switch (lang) {
      case 'de': return de;
      case 'it': return it;
      case 'en': return enUS;
      default: return fr;
    }
  };

  // Tenant branding info with fallbacks
  const companyName = tenant?.branding?.display_name || tenant?.name || "Cabinet";
  const companyLogo = tenant?.branding?.logo_url || null;
  const companyAddress = tenant?.branding?.company_address || "";
  const companyPhone = tenant?.branding?.company_phone || "";
  const companyEmail = tenant?.branding?.company_email || "";
  const companyWebsite = tenant?.branding?.company_website || "";

  const getClientName = () => {
    if (client.company_name) return client.company_name;
    return `${client.last_name || ""} ${client.first_name || ""}`.trim() || "N/A";
  };

  const getClientPrenom = () => {
    if (client.company_name) return client.company_name;
    return client.first_name || "N/A";
  };

  const getFullAddress = () => {
    return client.address || "N/A";
  };

  const getLocality = () => {
    const parts = [client.zip_code, client.city].filter(Boolean);
    return parts.join(" ") || "N/A";
  };

  const getBirthdate = () => {
    if (!client.birthdate) return "N/A";
    return format(new Date(client.birthdate), "dd.MM.yyyy");
  };

  const getInsurancesList = () => {
    const list: { type: string; company: string }[] = [];
    if (insurances.rcMenage !== "Non") list.push({ type: "RC Ménage", company: insurances.rcMenage });
    if (insurances.auto !== "Non") list.push({ type: "Assurance Auto", company: insurances.auto });
    if (insurances.protectionJuridique !== "Non") list.push({ type: "Protection Juridique", company: insurances.protectionJuridique });
    if (insurances.sante !== "Non") list.push({ type: "Assurance Santé", company: insurances.sante });
    if (insurances.vie3ePilier !== "Non") list.push({ type: "3e Pilier / Vie", company: insurances.vie3ePilier });
    if (insurances.autre !== "Non") list.push({ type: "Autre", company: insurances.autre === "Autre" ? autreCompany : insurances.autre });
    return list;
  };

  const generatePDFBlob = async (): Promise<Blob | null> => {
    if (!mandatRef.current) return null;
    
    const opt = {
      margin: [8, 10, 8, 10] as [number, number, number, number],
      filename: `Mandat_Gestion_${getClientName().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        allowTaint: true,
        logging: false
      },
      jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    const pdfBlob = await html2pdf().set(opt).from(mandatRef.current).output('blob');
    return pdfBlob;
  };

  const handleGeneratePDF = async () => {
    if (!mandatRef.current) return;

    try {
      if (!user?.id) {
        throw new Error("Non authentifie. Veuillez vous reconnecter.");
      }
      const opt = {
        margin: [8, 10, 8, 10] as [number, number, number, number],
        filename: `Mandat_Gestion_${getClientName().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false
        },
        jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(opt).from(mandatRef.current).save();
    } catch (error: any) {
      console.error('Erreur génération PDF:', error);
      toast({
        title: t('mandatForm.error'),
        description: error.message || "Erreur lors de la génération du PDF",
        variant: "destructive"
      });
    }
  };

  const handleSaveMandat = async () => {
    if (!signatureAdvisy || !signatureClient) {
      toast({
        title: t('mandatForm.signaturesRequired'),
        description: t('mandatForm.signaturesRequiredDesc'),
        variant: "destructive"
      });
      return;
    }

    if (!mandatRef.current) {
      toast({
        title: t('mandatForm.error'),
        description: t('mandatForm.showPreviewFirst'),
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: t('mandatForm.error'),
        description: "Session expirée. Veuillez vous reconnecter.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      // Générer le PDF
      const pdfBlob = await generatePDFBlob();
      if (!pdfBlob) throw new Error("Erreur lors de la génération du PDF");

      // Créer le nom du fichier
      const fileName = `Mandat_Gestion_${getClientName().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.pdf`;
      const fileKey = `${user.id}/mandats/${client.id}/${fileName}`;

      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileKey, pdfBlob, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Créer l'entrée dans la table documents
      await createDocument({
        owner_id: client.id,
        owner_type: 'client',
        file_name: fileName,
        file_key: fileKey,
        mime_type: 'application/pdf',
        size_bytes: pdfBlob.size,
        doc_kind: 'mandat_gestion',
      });

      const deliveryWarnings: string[] = [];
      const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client';
      const clientLoginUrl = buildTenantLoginUrl(tenant?.slug, "client");

      // Send mandat signed email with account creation
      if (client.email) {
        const emailResult = await sendMandatSignedEmail(client.email, clientName);
        if (!emailResult.success) {
          deliveryWarnings.push("Email d'accès client non envoyé.");
        }
      } else {
        deliveryWarnings.push("Aucun email client renseigné.");
      }

      const phone = client.mobile || client.phone;
      if (phone) {
        try {
          await invokeSupabaseFunction("send-sms", {
            body: {
              recipients: [{ phone, name: clientName }],
              tenantId,
              message: `Bonjour ${clientName}, votre mandat de gestion a été signé. Votre espace client est disponible ici: ${clientLoginUrl}`,
            },
          });
        } catch (smsError) {
          console.error("Erreur envoi SMS mandat:", smsError);
          deliveryWarnings.push("SMS non envoyé.");
        }
      }

      toast({
        title: deliveryWarnings.length ? "Mandat enregistré, envoi à vérifier" : t('mandatForm.mandatSaved'),
        description: deliveryWarnings.length
          ? `Le document est enregistré. ${deliveryWarnings.join(" ")}`
          : t('mandatForm.mandatSavedDesc'),
        variant: deliveryWarnings.length ? "destructive" : "default",
      });

      // Callback pour rafraîchir la liste des documents
      onSaved?.();

    } catch (error: any) {
      console.error('Erreur sauvegarde mandat:', error);
      toast({
        title: t('mandatForm.error'),
        description: error.message || t('mandatForm.saveError'),
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Send the mandat for remote signature: broker has signed (signatureAdvisy required),
  // client signature will be captured later via the public /signer/:token page.
  const handleSendForRemoteSignature = async () => {
    if (!signatureAdvisy) {
      toast({
        title: t('mandatForm.advisorSignatureRequired') || "Signature courtier requise",
        description: t('mandatForm.advisorSignatureRequiredDesc') || "Veuillez signer en bas du mandat avant de l'envoyer pour signature à distance.",
        variant: "destructive",
      });
      return;
    }
    if (!client.email && !client.mobile && !client.phone) {
      toast({
        title: t('mandatForm.noContactInfo') || "Coordonnées client manquantes",
        description: t('mandatForm.noContactInfoDesc') || "Le client n'a ni email ni téléphone. Ajoutez au moins un moyen de contact.",
        variant: "destructive",
      });
      return;
    }
    if (!user?.id || !tenantId) {
      toast({
        title: t('mandatForm.error'),
        description: "Session expirée. Veuillez vous reconnecter.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingInvite(true);

    try {
      const payload: MandatTemplateData = {
        companyName,
        companyLogo,
        companyAddress,
        companyPhone,
        companyEmail,
        companyWebsite,
        primaryColor: tenant?.branding?.primary_color || '#1800AD',
        clientName: getClientName(),
        clientFullAddress: getFullAddress(),
        clientLocality: getLocality(),
        clientBirthdate: getBirthdate(),
        clientEmail: client.email,
        clientPhone: client.mobile || client.phone,
        clientNationality: client.nationality,
        clientPermitType: client.permit_type,
        insurances,
        autreCompany,
        lieu,
        signatureDate: new Date().toISOString(),
        signatureAdvisy,
        signatureClient: null,
      };

      const { data: sr, error: insertError } = await supabase
        .from('signature_requests')
        .insert({
          tenant_id: tenantId,
          client_id: client.id,
          created_by: user.id,
          document_kind: 'mandat_gestion',
          payload: payload as unknown as Record<string, unknown>,
        })
        .select('id, access_token')
        .single();

      if (insertError || !sr) throw insertError || new Error("Création de la demande de signature échouée");

      await invokeSupabaseFunction("send-signature-invite", {
        body: {
          signatureRequestId: sr.id,
          appOrigin: window.location.origin,
        },
      });

      toast({
        title: t('mandatForm.inviteSent') || "Invitation envoyée",
        description: t('mandatForm.inviteSentDesc') || "Le client a reçu un lien pour signer le mandat à distance.",
      });

      onSaved?.();
    } catch (error: unknown) {
      console.error("Erreur envoi signature à distance:", error);
      toast({
        title: t('mandatForm.error'),
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handlePrint = () => {
    if (!mandatRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: t('mandatForm.error'),
        description: "Impossible d'ouvrir la fenêtre d'impression. Vérifiez que les popups ne sont pas bloquées.",
        variant: "destructive"
      });
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mandat de Gestion - ${getClientName()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; color: #000; }
            h1 { color: #1800AD; text-align: center; margin-bottom: 30px; }
            h2 { color: #1800AD; margin-top: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #1800AD; }
            .section { margin-bottom: 20px; }
            .field { margin-bottom: 10px; }
            .label { font-weight: bold; }
            .signature-box { margin-top: 40px; display: flex; justify-content: space-between; }
            .signature-area { width: 45%; border-top: 1px solid #000; padding-top: 10px; text-align: center; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          ${DOMPurify.sanitize(mandatRef.current.innerHTML)}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            {t('mandatForm.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informations client pré-remplies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <Label className="text-muted-foreground">{t('mandatForm.nameCompany')}</Label>
              <p className="font-medium">{getClientName()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('mandatForm.firstNameContact')}</Label>
              <p className="font-medium">{getClientPrenom()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('mandatForm.address')}</Label>
              <p className="font-medium">{getFullAddress()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('mandatForm.locality')}</Label>
              <p className="font-medium">{getLocality()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('mandatForm.birthdate')}</Label>
              <p className="font-medium">{getBirthdate()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('mandatForm.email')}</Label>
              <p className="font-medium">{client.email || "N/A"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('mandatForm.phone')}</Label>
              <p className="font-medium">{client.mobile || client.phone || "N/A"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t('mandatForm.nationalityPermit')}</Label>
              <p className="font-medium">{client.nationality || "N/A"} / {client.permit_type || "N/A"}</p>
            </div>
          </div>

          {/* Formulaire assurances actuelles */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">{t('mandatForm.currentInsurances')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('mandatForm.currentInsurancesDescription')}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('mandatForm.rcMenage')}</Label>
                <Select value={insurances.rcMenage} onValueChange={(v) => setInsurances({ ...insurances, rcMenage: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c === "Non" ? t('mandatForm.no') : c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('mandatForm.autoInsurance')}</Label>
                <Select value={insurances.auto} onValueChange={(v) => setInsurances({ ...insurances, auto: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c === "Non" ? t('mandatForm.no') : c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('mandatForm.legalProtection')}</Label>
                <Select value={insurances.protectionJuridique} onValueChange={(v) => setInsurances({ ...insurances, protectionJuridique: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c === "Non" ? t('mandatForm.no') : c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('mandatForm.healthInsurance')}</Label>
                <Select value={insurances.sante} onValueChange={(v) => setInsurances({ ...insurances, sante: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c === "Non" ? t('mandatForm.no') : c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('mandatForm.pillar3Life')}</Label>
                <Select value={insurances.vie3ePilier} onValueChange={(v) => setInsurances({ ...insurances, vie3ePilier: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c === "Non" ? t('mandatForm.no') : c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('mandatForm.otherInsurance')}</Label>
                <Select value={insurances.autre} onValueChange={(v) => setInsurances({ ...insurances, autre: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {insuranceCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c === "Non" ? t('mandatForm.no') : c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {insurances.autre === "Autre" && (
                  <Input 
                    placeholder={t('mandatForm.companyName')}
                    value={autreCompany}
                    onChange={(e) => setAutreCompany(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Lieu de signature */}
          <div className="space-y-2">
            <Label>{t('mandatForm.signatureLocation')}</Label>
            <Input 
              placeholder={t('mandatForm.signatureLocationPlaceholder')}
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
            />
          </div>

          {/* Signatures digitales */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">{t('mandatForm.signatures')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SignaturePad
                label={t('mandatForm.signatureCabinet', { cabinet: companyName })}
                onSignatureChange={setSignatureAdvisy}
                signature={signatureAdvisy}
              />
              <SignaturePad
                label={t('mandatForm.signatureClient')}
                onSignatureChange={setSignatureClient}
                signature={signatureClient}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowPreview(!showPreview)} variant="outline">
              {showPreview ? t('mandatForm.hidePreview') : t('mandatForm.showPreview')}
            </Button>
            <Button onClick={handleGeneratePDF} className="gap-2">
              <FileDown className="h-4 w-4" />
              {t('mandatForm.downloadPdf')}
            </Button>
            <Button onClick={handlePrint} variant="secondary" className="gap-2">
              <Printer className="h-4 w-4" />
              {t('mandatForm.print')}
            </Button>
            <Button
              onClick={handleSaveMandat}
              disabled={isSaving || !signatureAdvisy || !signatureClient}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? t('common.saving') : t('mandatForm.saveMandat')}
            </Button>
            <Button
              onClick={handleSendForRemoteSignature}
              disabled={isSendingInvite || !signatureAdvisy}
              variant="default"
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {isSendingInvite ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isSendingInvite
                ? (t('mandatForm.sendingInvite') || 'Envoi en cours…')
                : (t('mandatForm.sendForRemoteSignature') || 'Envoyer pour signature à distance')}
            </Button>
          </div>
          <div className="space-y-1">
            {(!signatureAdvisy || !signatureClient) && (
              <p className="text-sm text-muted-foreground">
                {t('mandatForm.signaturesRequiredDesc')}
              </p>
            )}
            {!signatureAdvisy && (
              <p className="text-xs text-amber-700">
                {t('mandatForm.advisorSignatureRequiredHint') || "La signature courtier est requise avant l'envoi à distance."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Aperçu du mandat */}
      {/* Aperçu du mandat — toujours rendu (caché si !showPreview) pour pouvoir générer le PDF même sans afficher l'aperçu */}
      <Card style={showPreview ? undefined : { position: 'fixed', top: 0, left: '-99999px', width: '210mm', visibility: 'hidden', pointerEvents: 'none' }}>
        <CardHeader>
          <CardTitle>{t('mandatForm.showPreview')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <MandatTemplate
            ref={mandatRef}
            companyName={companyName}
            companyLogo={companyLogo}
            companyAddress={companyAddress}
            companyPhone={companyPhone}
            companyEmail={companyEmail}
            companyWebsite={companyWebsite}
            primaryColor={tenant?.branding?.primary_color || '#1800AD'}
            clientName={getClientName()}
            clientFullAddress={getFullAddress()}
            clientLocality={getLocality()}
            clientBirthdate={getBirthdate()}
            clientEmail={client.email}
            clientPhone={client.mobile || client.phone}
            clientNationality={client.nationality}
            clientPermitType={client.permit_type}
            insurances={insurances}
            autreCompany={autreCompany}
            lieu={lieu}
            signatureAdvisy={signatureAdvisy}
            signatureClient={signatureClient}
          />
        </CardContent>
      </Card>
    </div>
  );
}
