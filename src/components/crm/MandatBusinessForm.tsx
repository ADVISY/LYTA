// MandatBusinessForm
// ==================
// Variante PRO du formulaire de création de mandat de gestion.
//
// Activé automatiquement par MandatGestionForm quand `client.is_company === true`.
// Reproduit le flow complet du mandat privé (saisie infos → signature broker +
// client → génération PDF → upload Storage → ligne signature_requests → auto
// dispatch aux compagnies) en l'adaptant aux spécificités d'une personne morale :
//
//   - 10 branches d'assurance pro (LAA, LAAC, LPP, PG maladie, Santé Collective,
//     RC pro, Véhicules à moteur, Protection juridique, RC bâtiment, Autres
//     assurances choses) au lieu des 5 perso (RC ménage, auto, etc.)
//
//   - Bloc "Informations entreprise" : raison sociale, IDE, registre du commerce
//     (canton + n°), adresse du siège — pré-rempli depuis la fiche client si déjà
//     saisi, modifiable à la volée pour ce mandat précis
//
//   - Bloc "Représentant légal signataire" : prénom + nom + fonction + pouvoir
//     de signature. Pré-rempli aussi depuis la fiche client.
//
//   - Le PDF est rendu via MandatBusinessTemplate (composant séparé) — pas via
//     du JSX inline comme MandatGestionForm le fait pour les particuliers. Ça
//     évite la duplication de ~600 lignes de mise en page.
//
// Le save Supabase et l'auto-dispatch aux compagnies sont strictement identiques
// au flow privé (même table signature_requests, même edge function
// dispatch-mandat-to-companies). Le PDF qu'on stocke est juste différent.
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, FileCheck, Save, Loader2, Briefcase, Send } from "lucide-react";
import { format } from "date-fns";
import { Client } from "@/hooks/useClients";
import html2pdf from "html2pdf.js";
import SignaturePad from "./SignaturePad";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useDocuments } from "@/hooks/useDocuments";
import { useTenant } from "@/contexts/TenantContext";
import { useUserTenant } from "@/hooks/useUserTenant";
import { invokeSupabaseFunction } from "@/lib/edgeFunctions";
import { MandatBusinessTemplate, MandatBusinessInsurances } from "@/components/signatures/MandatBusinessTemplate";

interface MandatBusinessFormProps {
  client: Client;
  onSaved?: () => void;
}

// Liste des compagnies — strictement identique au mandat privé pour cohérence
// (Sammuel/Habib peuvent évoluer cette liste indépendamment plus tard).
const insuranceCompanies = [
  "Non",
  "Allianz Suisse", "AXA", "Baloise", "CSS", "Generali", "Groupe Mutuel",
  "Helsana", "Helvetia", "La Mobilière", "Sanitas", "Swica", "Swiss Life",
  "Sympany", "Vaudoise", "Visana", "Zurich",
  "Autre",
];

// Fonctions classiques des représentants légaux d'entreprises suisses.
// Champ libre quand même via Input séparé si la fonction n'est pas dans la liste.
const LEGAL_REP_FUNCTIONS = [
  "Administrateur unique",
  "Administrateur président",
  "Administrateur",
  "Directeur général",
  "Directeur",
  "Gérant",
  "Gérant unique",
  "Président",
  "Associé gérant",
  "Fondé de pouvoir",
];

// Cantons suisses (alphabétique) pour le registre du commerce.
const CANTONS = ["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"];

const INITIAL_INSURANCES: MandatBusinessInsurances = {
  laa: "Non",
  laac: "Non",
  lpp: "Non",
  pgMaladie: "Non",
  santeCollective: "Non",
  rcPro: "Non",
  vehiculesMoteur: "Non",
  protectionJuridique: "Non",
  rcBatiment: "Non",
  autresChoses: "Non",
};

// Couple [clé state, label affiché côté broker]. Garde l'ordre métier Sammuel.
const INSURANCE_FIELDS: { key: keyof MandatBusinessInsurances; label: string }[] = [
  { key: "laa",                 label: "LAA — Assurance accidents" },
  { key: "laac",                label: "LAAC — Complémentaire LAA" },
  { key: "lpp",                 label: "LPP — 2ᵉ pilier" },
  { key: "pgMaladie",           label: "PG maladie (perte de gain)" },
  { key: "santeCollective",     label: "Santé collective" },
  { key: "rcPro",               label: "RC professionnelle" },
  { key: "vehiculesMoteur",     label: "Véhicules à moteur" },
  { key: "protectionJuridique", label: "Protection juridique" },
  { key: "rcBatiment",          label: "RC bâtiment" },
  { key: "autresChoses",        label: "Autres assurances choses" },
];

export default function MandatBusinessForm({ client, onSaved }: MandatBusinessFormProps) {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { tenantId } = useUserTenant();
  const { createDocument } = useDocuments();
  const { toast } = useToast();

  // Branding cabinet (identique au mandat privé)
  const companyName = tenant?.branding?.display_name || tenant?.name || "Cabinet";
  const companyLogo = tenant?.branding?.logo_url || null;
  const companyAddress = tenant?.branding?.company_address || "";
  const companyPhone = tenant?.branding?.company_phone || "";
  const companyEmail = tenant?.branding?.company_email || "";
  const companyWebsite = tenant?.branding?.company_website || "";

  // ── State formulaire ──────────────────────────────────────────
  const [insurances, setInsurances] = useState<MandatBusinessInsurances>(INITIAL_INSURANCES);
  const [autresChosesCompany, setAutresChosesCompany] = useState<string>("");

  // Champs entreprise — pré-remplis depuis la fiche client si déjà saisis.
  // Le broker peut les éditer ad-hoc pour ce mandat précis (cas où la fiche
  // n'est pas encore à jour ; on ne re-persiste PAS sur le client à ce stade,
  // ça vient dans l'itération "Fiche client — bloc entreprise").
  const c = client as Client & {
    ide?: string | null;
    rc_canton?: string | null;
    rc_number?: string | null;
    legal_rep_first_name?: string | null;
    legal_rep_last_name?: string | null;
    legal_rep_function?: string | null;
    signature_power?: "individual" | "collective_2" | null;
  };

  const [clientCompanyName, setClientCompanyName] = useState<string>(c.company_name || "");
  const [ide, setIde] = useState<string>(c.ide || "");
  const [rcCanton, setRcCanton] = useState<string>(c.rc_canton || "");
  const [rcNumber, setRcNumber] = useState<string>(c.rc_number || "");
  const [legalRepFirstName, setLegalRepFirstName] = useState<string>(
    c.legal_rep_first_name || c.first_name || ""
  );
  const [legalRepLastName, setLegalRepLastName] = useState<string>(
    c.legal_rep_last_name || c.last_name || ""
  );
  const [legalRepFunction, setLegalRepFunction] = useState<string>(
    c.legal_rep_function || ""
  );
  const [signaturePower, setSignaturePower] = useState<"individual" | "collective_2">(
    c.signature_power || "individual"
  );

  const [lieu, setLieu] = useState<string>("");
  const [signatureAdvisy, setSignatureAdvisy] = useState<string | null>(null);
  const [signatureClient, setSignatureClient] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingRemote, setIsSendingRemote] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const mandatRef = useRef<HTMLDivElement>(null);

  // ── Helpers ───────────────────────────────────────────────────
  const fullAddress = client.address || "N/A";
  const locality = [client.zip_code, client.city].filter(Boolean).join(" ") || "N/A";
  const legalRepFullName = `${legalRepFirstName} ${legalRepLastName}`.trim();

  const isFormReady =
    clientCompanyName.trim().length > 0 &&
    legalRepFirstName.trim().length > 0 &&
    legalRepLastName.trim().length > 0 &&
    legalRepFunction.trim().length > 0 &&
    !!signatureAdvisy &&
    !!signatureClient;

  // ── Génération PDF ────────────────────────────────────────────
  const generatePDFBlob = async (): Promise<Blob | null> => {
    if (!mandatRef.current) return null;
    const opt = {
      margin: [8, 10, 8, 10] as [number, number, number, number],
      filename: `Mandat_Gestion_PRO_${clientCompanyName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`,
      image: { type: "jpeg" as const, quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false },
      jsPDF: { unit: "mm" as const, format: "a4", orientation: "portrait" as const },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };
    return await html2pdf().set(opt).from(mandatRef.current).output("blob");
  };

  const handleDownloadPDF = async () => {
    if (!mandatRef.current) {
      setShowPreview(true);
      // Petit délai pour laisser le DOM rendre avant html2pdf
      setTimeout(handleDownloadPDF, 300);
      return;
    }
    try {
      const opt = {
        margin: [8, 10, 8, 10] as [number, number, number, number],
        filename: `Mandat_Gestion_PRO_${clientCompanyName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`,
        image: { type: "jpeg" as const, quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false },
        jsPDF: { unit: "mm" as const, format: "a4", orientation: "portrait" as const },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };
      await html2pdf().set(opt).from(mandatRef.current).save();
    } catch (e) {
      console.error("[MandatBusinessForm] generate PDF failed", e);
      toast({
        title: "Erreur",
        description: "Génération du PDF impossible. Voir la console.",
        variant: "destructive",
      });
    }
  };

  // ── Envoi pour signature à distance ───────────────────────────
  // Le client reçoit un email avec le lien /signer/:token. Il ouvre la
  // page, voit le PDF du mandat dans PdfZonePicker, drague la zone et
  // signe. complete-signature merge sa signature au bon endroit puis
  // déclenche le dispatch aux compagnies.
  //
  // Prérequis :
  //   - clientEmail défini (sinon impossible d'envoyer l'invitation)
  //   - signatureAdvisy (broker) signée — sa signature est incrustée
  //     dans le PDF envoyé. Le client n'a qu'à ajouter la sienne.
  //   - Tous les champs entreprise + représentant légal renseignés
  //     (sinon le PDF est incomplet).
  const isRemoteReady =
    !!client.email &&
    !!signatureAdvisy &&
    clientCompanyName.trim().length > 0 &&
    legalRepFirstName.trim().length > 0 &&
    legalRepLastName.trim().length > 0 &&
    legalRepFunction.trim().length > 0;

  const handleSendForRemoteSignature = async () => {
    if (!isRemoteReady) {
      toast({
        title: "Prérequis manquants",
        description: "L'email du client, ta signature cabinet, et toutes les infos entreprise/représentant sont obligatoires pour l'envoi à distance.",
        variant: "destructive",
      });
      return;
    }
    if (!user?.id || !tenantId) {
      toast({ title: "Session invalide", variant: "destructive" });
      return;
    }
    if (!mandatRef.current) {
      // Forcer l'aperçu pour que html2pdf trouve le DOM
      setShowPreview(true);
      setTimeout(handleSendForRemoteSignature, 300);
      return;
    }

    setIsSendingRemote(true);
    try {
      const pdfBlob = await generatePDFBlob();
      if (!pdfBlob) throw new Error("Génération PDF échouée");

      const fileName = `Mandat_Gestion_PRO_${clientCompanyName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd_HHmmss")}.pdf`;
      const fileKey = `${user.id}/mandats/${client.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileKey, pdfBlob, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      // Payload identique au save présentiel — même structure, juste
      // qu'on n'inclut pas la signature client (le client la dessinera).
      const payloadForDispatch = {
        insurances,
        clientKind: "business" as const,
        lieu,
        clientCompanyName,
        clientAddress: client.address ?? null,
        clientPostalCode: client.zip_code ?? null,
        clientCity: client.city ?? null,
        clientEmail: client.email ?? null,
        ide: ide || null,
        rcCanton: rcCanton || null,
        rcNumber: rcNumber || null,
        legalRepFirstName,
        legalRepLastName,
        legalRepFunction,
        signaturePower,
        cabinetName: companyName,
        brokerEmail: companyEmail || null,
        inPerson: false,
      };

      const accessToken =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? (crypto as Crypto).randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const nowIso = new Date().toISOString();
      // Lien valable 7 jours (vs 24h pour les imported — un mandat est
      // un acte plus engageant, on laisse au client le temps de réfléchir)
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

      const { data: srRow, error: srErr } = await (supabase as any)
        .from("signature_requests")
        .insert({
          tenant_id: tenantId,
          client_id: client.id,
          created_by: user.id,
          document_kind: "mandat_gestion",
          payload: payloadForDispatch,
          preview_file_key: fileKey,   // ← clé du flow distance : Signer.tsx détecte ça
          client_full_name: clientCompanyName,
          status: "sent",
          access_token: accessToken,
          expires_at: expiresAt,
          invited_at: nowIso,
        })
        .select("id")
        .single();

      if (srErr || !srRow) {
        throw srErr || new Error("Création de la demande de signature échouée");
      }

      // Envoi de l'email d'invitation via send-signature-invite
      await invokeSupabaseFunction("send-signature-invite", {
        body: { signatureRequestId: srRow.id, appOrigin: window.location.origin },
      });

      toast({
        title: "Mandat envoyé pour signature à distance ✓",
        description: `${client.email} a reçu un lien sécurisé. Il a 7 jours pour signer. Tu seras notifié dès la signature.`,
      });

      onSaved?.();
    } catch (e: any) {
      console.error("[MandatBusinessForm] remote send failed", e);
      toast({
        title: "Envoi à distance échoué",
        description: e?.message || "Voir la console (F12) pour le détail.",
        variant: "destructive",
      });
    } finally {
      setIsSendingRemote(false);
    }
  };

  // ── Save + dispatch (même flow que mandat privé) ──────────────
  const handleSaveMandat = async () => {
    if (!isFormReady) {
      toast({
        title: "Champs manquants",
        description: "Raison sociale, représentant légal (prénom, nom, fonction) et les deux signatures sont obligatoires.",
        variant: "destructive",
      });
      return;
    }
    if (!user?.id || !tenantId) {
      toast({ title: "Session invalide", variant: "destructive" });
      return;
    }
    // Rendre le preview AVANT html2pdf
    if (!mandatRef.current) {
      setShowPreview(true);
      setTimeout(handleSaveMandat, 300);
      return;
    }

    setIsSaving(true);
    try {
      const pdfBlob = await generatePDFBlob();
      if (!pdfBlob) throw new Error("Génération PDF échouée");

      const fileName = `Mandat_Gestion_PRO_${clientCompanyName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd_HHmmss")}.pdf`;
      const fileKey = `${user.id}/mandats/${client.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileKey, pdfBlob, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      const createdDoc = await createDocument({
        owner_id: client.id,
        owner_type: "client",
        file_name: fileName,
        file_key: fileKey,
        mime_type: "application/pdf",
        size_bytes: pdfBlob.size,
        doc_kind: "mandat_gestion",
      });

      // Crée la ligne signature_requests pour bridge dispatch + auto-envoi
      const payloadForDispatch = {
        // On garde la même structure "insurances" reconnue par
        // dispatch-mandat-to-companies (les compagnies sont les valeurs
        // selectionnées par branche, ce qui matche déjà l'attendu de
        // l'edge function : `payload.insurances` est itéré pour extraire
        // les compagnies à contacter — la nature pro/privé n'affecte pas
        // le dispatch côté serveur).
        insurances,
        clientKind: "business" as const,
        lieu,
        clientCompanyName,
        clientAddress: client.address ?? null,
        clientPostalCode: client.zip_code ?? null,
        clientCity: client.city ?? null,
        clientEmail: client.email ?? null,
        ide: ide || null,
        rcCanton: rcCanton || null,
        rcNumber: rcNumber || null,
        legalRepFirstName,
        legalRepLastName,
        legalRepFunction,
        signaturePower,
        cabinetName: companyName,
        brokerEmail: companyEmail || null,
        inPerson: true,
      };

      const accessToken =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? (crypto as Crypto).randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const nowIso = new Date().toISOString();

      let dispatchSignatureRequestId: string | null = null;
      const { data: srRow, error: srErr } = await (supabase as any)
        .from("signature_requests")
        .insert({
          tenant_id: tenantId,
          client_id: client.id,
          created_by: user.id,
          document_kind: "mandat_gestion",
          payload: payloadForDispatch,
          preview_file_key: fileKey,
          signed_file_key: fileKey,
          signed_document_id: createdDoc?.id ?? null,
          client_signature_image: signatureClient,
          client_full_name: clientCompanyName,
          status: "signed",
          access_token: accessToken,
          expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          invited_at: nowIso,
          signed_at: nowIso,
        })
        .select("id")
        .single();

      if (srErr || !srRow) {
        console.warn("[MandatBusinessForm] dispatch-bridge signature_request creation failed", srErr);
        toast({
          title: "Mandat enregistré (envoi compagnies à faire manuellement)",
          description: "La ligne de bridge dispatch n'a pas pu être créée. Tu peux relancer l'envoi depuis l'onglet Signatures.",
        });
      } else {
        dispatchSignatureRequestId = srRow.id as string;

        // Auto-dispatch (fire-and-forget — les erreurs sont non-bloquantes)
        try {
          const dispatchResp = await invokeSupabaseFunction<{
            ok?: true;
            dispatched?: number;
            manual_required?: number;
            failed?: number;
          }>("dispatch-mandat-to-companies", {
            body: { signature_request_id: dispatchSignatureRequestId },
          });
          const sent = dispatchResp?.dispatched ?? 0;
          const manual = dispatchResp?.manual_required ?? 0;
          const failed = dispatchResp?.failed ?? 0;
          toast({
            title: "Mandat PRO enregistré ✓",
            description: `Dispatch compagnies : ${sent} envoyé(s)${manual ? `, ${manual} à faire manuellement` : ""}${failed ? `, ${failed} échec(s)` : ""}.`,
          });
        } catch (dispatchErr) {
          console.warn("[MandatBusinessForm] auto-dispatch failed", dispatchErr);
          toast({
            title: "Mandat PRO enregistré ✓",
            description: "Dispatch automatique aux compagnies échoué — relance manuelle possible depuis l'onglet Signatures.",
          });
        }
      }

      onSaved?.();
    } catch (e: any) {
      console.error("[MandatBusinessForm] save failed", e);
      toast({
        title: "Erreur lors de la sauvegarde",
        description: e?.message || "Voir la console (F12) pour le détail.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Mandat de gestion — Client entreprise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ── Bloc 1 : Informations entreprise ───────────────── */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FileCheck className="h-4 w-4" /> Informations entreprise
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Raison sociale *</Label>
                <Input
                  value={clientCompanyName}
                  onChange={(e) => setClientCompanyName(e.target.value)}
                  placeholder="Ex: Optimislink Sàrl"
                />
              </div>
              <div className="space-y-2">
                <Label>N° IDE</Label>
                <Input
                  value={ide}
                  onChange={(e) => setIde(e.target.value)}
                  placeholder="CHE-XXX.XXX.XXX"
                />
              </div>
              <div className="space-y-2">
                <Label>Canton du RC</Label>
                <Select value={rcCanton || "_none"} onValueChange={(v) => setRcCanton(v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Canton" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Non renseigné —</SelectItem>
                    {CANTONS.map((ct) => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>N° d'inscription au RC</Label>
                <Input
                  value={rcNumber}
                  onChange={(e) => setRcNumber(e.target.value)}
                  placeholder="Ex: CH-550.1.234.567-8"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-muted-foreground">Adresse du siège (depuis la fiche client)</Label>
                <p className="text-sm font-medium">{fullAddress} — {locality}</p>
              </div>
            </div>
          </div>

          {/* ── Bloc 2 : Représentant légal signataire ─────────── */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Représentant légal signataire</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom *</Label>
                <Input
                  value={legalRepFirstName}
                  onChange={(e) => setLegalRepFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={legalRepLastName}
                  onChange={(e) => setLegalRepLastName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fonction *</Label>
                <Select value={legalRepFunction} onValueChange={setLegalRepFunction}>
                  <SelectTrigger><SelectValue placeholder="Choisir une fonction" /></SelectTrigger>
                  <SelectContent>
                    {LEGAL_REP_FUNCTIONS.map((fn) => (
                      <SelectItem key={fn} value={fn}>{fn}</SelectItem>
                    ))}
                    <SelectItem value="__other__">Autre (saisir ci-dessous)</SelectItem>
                  </SelectContent>
                </Select>
                {legalRepFunction === "__other__" && (
                  <Input
                    placeholder="Fonction (libre)"
                    onChange={(e) => setLegalRepFunction(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Pouvoir de signature</Label>
                <Select value={signaturePower} onValueChange={(v) => setSignaturePower(v as "individual" | "collective_2")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individuel (1 signataire suffit)</SelectItem>
                    <SelectItem value="collective_2">Collectif à deux (2 signataires requis)</SelectItem>
                  </SelectContent>
                </Select>
                {signaturePower === "collective_2" && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Le support de la signature collective à 2 (envoi à 2 signataires distincts) viendra dans une itération suivante. Pour ce mandat, seul le représentant ci-dessus signera.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Bloc 3 : Portefeuille assurances pro (10 branches) ── */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Portefeuille d'assurances actuel</h3>
            <p className="text-sm text-muted-foreground">
              Indique pour chaque branche la compagnie actuelle (ou "Non" si l'entreprise n'en a pas).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INSURANCE_FIELDS.map(({ key, label }) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Select
                    value={insurances[key]}
                    onValueChange={(v) => setInsurances({ ...insurances, [key]: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {insuranceCompanies.map((co) => (
                        <SelectItem key={co} value={co}>{co === "Non" ? "—" : co}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {key === "autresChoses" && insurances.autresChoses === "Autre" && (
                    <Input
                      placeholder="Nom de la compagnie"
                      value={autresChosesCompany}
                      onChange={(e) => setAutresChosesCompany(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Bloc 4 : Lieu signature ────────────────────────── */}
          <div className="space-y-2">
            <Label>Lieu de signature</Label>
            <Input
              placeholder="Ex: Lausanne"
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
            />
          </div>

          {/* ── Bloc 5 : Signatures ────────────────────────────── */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Signatures</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SignaturePad
                label={`Signature ${companyName} (Mandataire)`}
                onSignatureChange={setSignatureAdvisy}
                signature={signatureAdvisy}
              />
              <SignaturePad
                label={`Signature ${legalRepFullName || "représentant"} (Mandant)`}
                onSignatureChange={setSignatureClient}
                signature={signatureClient}
              />
            </div>
          </div>

          {/* ── Actions ──────────────────────────────────────────
              Deux flows distincts :
              • Enregistrer (présentiel) : les deux signatures sont
                déjà dans le formulaire, on enregistre + dispatch direct
              • Envoyer pour signature à distance : le client signera
                lui-même via le lien email (PdfZonePicker + signature)
                puis le dispatch sera déclenché par complete-signature */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowPreview(!showPreview)} variant="outline">
              {showPreview ? "Masquer l'aperçu" : "Afficher l'aperçu"}
            </Button>
            <Button onClick={handleDownloadPDF} variant="secondary" className="gap-2">
              <FileDown className="h-4 w-4" /> Télécharger le PDF
            </Button>

            {/* Présentiel — les deux signatures sont déjà dans le form */}
            <Button
              onClick={handleSaveMandat}
              disabled={isSaving || isSendingRemote || !isFormReady}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Enregistrement…" : "Enregistrer (présentiel) + envoyer aux compagnies"}
            </Button>

            {/* À distance — le client signera via lien email */}
            <Button
              onClick={handleSendForRemoteSignature}
              disabled={isSendingRemote || isSaving || !isRemoteReady}
              variant="outline"
              className="gap-2 border-primary text-primary hover:bg-primary/10"
            >
              {isSendingRemote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSendingRemote ? "Envoi en cours…" : "Envoyer pour signature à distance"}
            </Button>
          </div>

          {!isFormReady && (
            <p className="text-sm text-muted-foreground">
              <strong>Présentiel</strong> : raison sociale, représentant légal (prénom, nom, fonction) et les deux signatures sont requis.
            </p>
          )}
          {!isRemoteReady && (
            <p className="text-sm text-muted-foreground">
              <strong>Signature à distance</strong> : email du client {!client.email && <span className="text-destructive">(manquant — édite la fiche client)</span>}, ta signature cabinet et les infos entreprise/représentant sont requis. Le client signera lui-même via le lien reçu par email.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Aperçu mandat ─────────────────────────────────────── */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Aperçu du mandat</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto bg-slate-100 p-4">
            <MandatBusinessTemplate
              ref={mandatRef}
              companyName={companyName}
              companyLogo={companyLogo}
              companyAddress={companyAddress}
              companyPhone={companyPhone}
              companyEmail={companyEmail}
              companyWebsite={companyWebsite}
              primaryColor={tenant?.branding?.primary_color || "#1800AD"}
              clientCompanyName={clientCompanyName}
              clientFullAddress={fullAddress}
              clientLocality={locality}
              clientEmail={client.email}
              clientPhone={client.mobile || client.phone}
              clientIde={ide}
              clientRcCanton={rcCanton}
              clientRcNumber={rcNumber}
              legalRepFirstName={legalRepFirstName}
              legalRepLastName={legalRepLastName}
              legalRepFunction={legalRepFunction === "__other__" ? "" : legalRepFunction}
              signaturePower={signaturePower}
              insurances={insurances}
              autresChosesCompany={autresChosesCompany}
              lieu={lieu}
              signatureAdvisy={signatureAdvisy}
              signatureClient={signatureClient}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
