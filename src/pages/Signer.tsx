// Public signing page accessed via /signer/:token. Does NOT require authentication.
// Loads the signature request via an RPC, lets the client review the document, sign,
// then posts the final PDF to the complete-signature edge function.
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import html2pdf from "html2pdf.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldCheck, FileSignature, Check, AlertCircle, XCircle } from "lucide-react";
import SignaturePad from "@/components/crm/SignaturePad";
import { MandatTemplate, MandatTemplateData } from "@/components/signatures/MandatTemplate";
import { supabase } from "@/integrations/supabase/client";
import { supabaseConfig } from "@/integrations/supabase/config";

interface SignatureRequestRow {
  id: string;
  tenant_id: string;
  client_id: string;
  document_kind: string;
  payload: (MandatTemplateData & Record<string, unknown>) | { label?: string; description?: string; originalFileName?: string };
  preview_file_key: string | null;
  status: string;
  expires_at: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_company_name: string | null;
  tenant_name: string | null;
  tenant_logo_url: string | null;
  tenant_primary_color: string | null;
}

type ScreenState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "already_signed" }
  | { kind: "expired" }
  | { kind: "cancelled" }
  | { kind: "ready"; request: SignatureRequestRow }
  | { kind: "submitting"; request: SignatureRequestRow }
  | { kind: "success" }
  | { kind: "refused" };

const DOCUMENT_LABELS: Record<string, string> = {
  mandat_gestion: "Mandat de gestion",
  procuration: "Procuration",
  resiliation_lca_45: "Résiliation LCA art. 45",
  imported: "Document à signer",
  autre: "Document à signer",
};

export default function Signer() {
  const { token } = useParams<{ token: string }>();
  const [screen, setScreen] = useState<ScreenState>({ kind: "loading" });

  // Form state
  const [signatureClient, setSignatureClient] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [refusalMode, setRefusalMode] = useState(false);
  const [refusalReason, setRefusalReason] = useState("");

  const documentRef = useRef<HTMLDivElement>(null);
  const attestationRef = useRef<HTMLDivElement>(null);

  // For imported PDFs: signed URL + sha256 hash of the original document
  const [importedPdfUrl, setImportedPdfUrl] = useState<string | null>(null);
  const [importedPdfHash, setImportedPdfHash] = useState<string | null>(null);
  const [importedPdfLoading, setImportedPdfLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!token) {
        setScreen({ kind: "error", message: "Lien invalide" });
        return;
      }

      const { data, error } = await supabase.rpc("get_signature_request_by_token", { p_token: token });
      if (!active) return;

      if (error) {
        setScreen({ kind: "error", message: error.message || "Lien invalide ou expiré" });
        return;
      }

      const row = Array.isArray(data) ? (data[0] as SignatureRequestRow | undefined) : undefined;
      if (!row) {
        setScreen({ kind: "error", message: "Lien introuvable" });
        return;
      }

      if (row.status === "signed") {
        setScreen({ kind: "already_signed" });
        return;
      }
      if (row.status === "cancelled") {
        setScreen({ kind: "cancelled" });
        return;
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        setScreen({ kind: "expired" });
        return;
      }

      // Mark as viewed (best effort, idempotent)
      void supabase.rpc("mark_signature_request_viewed", { p_token: token });

      // Pre-fill the full name with the known client name
      const guessedName = row.client_company_name ||
        `${row.client_first_name || ""} ${row.client_last_name || ""}`.trim();
      setFullName(guessedName);

      setScreen({ kind: "ready", request: row });
    };

    void load();
    return () => { active = false; };
  }, [token]);

  const documentLabel = useMemo(() => {
    if (screen.kind === "ready" || screen.kind === "submitting") {
      const r = screen.request;
      // For imported docs, prefer the broker-provided label
      if (r.document_kind === "imported" || r.document_kind === "autre") {
        const l = (r.payload as { label?: string })?.label;
        if (l) return l;
      }
      return DOCUMENT_LABELS[r.document_kind] || "Document à signer";
    }
    return "Document à signer";
  }, [screen]);

  // For imported documents, fetch the signed URL + the hash of the original PDF
  useEffect(() => {
    if (screen.kind !== "ready") return;
    const r = screen.request;
    if (r.document_kind !== "imported" && r.document_kind !== "autre") return;
    if (!r.preview_file_key || importedPdfUrl) return;

    let cancelled = false;
    const load = async () => {
      setImportedPdfLoading(true);
      try {
        const resp = await fetch(`${supabaseConfig.url}/functions/v1/get-signature-pdf-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseConfig.publishableKey,
            "Authorization": `Bearer ${supabaseConfig.publishableKey}`,
          },
          body: JSON.stringify({ token }),
        });
        if (!resp.ok) throw new Error("Impossible de charger le document");
        const { url } = await resp.json();
        if (cancelled) return;
        setImportedPdfUrl(url);

        // Fetch and hash the PDF for integrity proof
        const pdfResp = await fetch(url);
        if (!pdfResp.ok) throw new Error("Téléchargement du PDF échoué");
        const buf = await pdfResp.arrayBuffer();
        const hashBuf = await crypto.subtle.digest("SHA-256", buf);
        const hashHex = Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (!cancelled) setImportedPdfHash(hashHex);
      } catch (err) {
        // Surface but don't crash; UI shows a fallback message
        console.error("Imported PDF load error", err);
      } finally {
        if (!cancelled) setImportedPdfLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [screen, token, importedPdfUrl]);

  const generateSignedPdfBase64 = async (): Promise<string> => {
    // For mandat: render the full mandat template with both signatures.
    // For imported: render only the attestation page (the original PDF is preserved separately).
    const target = screen.kind === "ready" && (screen.request.document_kind === "imported" || screen.request.document_kind === "autre")
      ? attestationRef.current
      : documentRef.current;
    if (!target) throw new Error("Aperçu indisponible");

    const opt = {
      margin: [8, 10, 8, 10] as [number, number, number, number],
      filename: "document_signe.pdf",
      image: { type: "jpeg" as const, quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false },
      jsPDF: { unit: "mm" as const, format: "a4", orientation: "portrait" as const },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    const blob: Blob = await html2pdf().set(opt).from(target).output("blob");
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    return btoa(binary);
  };

  const callCompleteSignature = async (body: Record<string, unknown>) => {
    const resp = await fetch(`${supabaseConfig.url}/functions/v1/complete-signature`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Public anon key required by Supabase Edge runtime even when verify_jwt is false
        "apikey": supabaseConfig.publishableKey,
        "Authorization": `Bearer ${supabaseConfig.publishableKey}`,
      },
      body: JSON.stringify(body),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error((json && (json.error || json.message)) || `Erreur de service (${resp.status})`);
    }
    return json;
  };

  const handleSubmit = async () => {
    if (screen.kind !== "ready") return;
    if (!signatureClient) {
      alert("Veuillez dessiner votre signature avant de continuer.");
      return;
    }
    if (!accepted) {
      alert("Vous devez confirmer avoir lu et accepté le document.");
      return;
    }
    if (fullName.trim().length < 3) {
      alert("Veuillez saisir votre nom complet.");
      return;
    }

    setScreen({ kind: "submitting", request: screen.request });

    try {
      // Wait one frame so the rendered MandatTemplate picks up the latest signatureClient
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const signedPdfBase64 = await generateSignedPdfBase64();

      await callCompleteSignature({
        token,
        signedPdfBase64,
        clientSignatureImage: signatureClient,
        clientFullName: fullName.trim(),
      });

      setScreen({ kind: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setScreen({ kind: "error", message });
    }
  };

  const handleRefuse = async () => {
    if (screen.kind !== "ready") return;
    setScreen({ kind: "submitting", request: screen.request });
    try {
      await callCompleteSignature({
        token,
        refused: true,
        refusalReason: refusalReason.trim().slice(0, 500),
        signedPdfBase64: "",
        clientSignatureImage: "",
        clientFullName: "",
      });
      setScreen({ kind: "refused" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setScreen({ kind: "error", message });
    }
  };

  // ---------- Render branches ----------

  if (screen.kind === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-[#1800AD]" />
      </div>
    );
  }

  if (screen.kind === "error") {
    return (
      <CenterCard>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{screen.message}</AlertDescription>
        </Alert>
      </CenterCard>
    );
  }

  if (screen.kind === "already_signed") {
    return (
      <CenterCard>
        <div className="text-center space-y-4 py-8">
          <Check className="h-16 w-16 mx-auto text-emerald-500" />
          <h1 className="text-2xl font-bold">Document déjà signé</h1>
          <p className="text-muted-foreground">Ce document a déjà été signé. Aucune action supplémentaire n'est requise.</p>
        </div>
      </CenterCard>
    );
  }

  if (screen.kind === "expired") {
    return (
      <CenterCard>
        <div className="text-center space-y-4 py-8">
          <AlertCircle className="h-16 w-16 mx-auto text-amber-500" />
          <h1 className="text-2xl font-bold">Lien expiré</h1>
          <p className="text-muted-foreground">Ce lien de signature a expiré. Contactez votre conseiller pour en recevoir un nouveau.</p>
        </div>
      </CenterCard>
    );
  }

  if (screen.kind === "cancelled") {
    return (
      <CenterCard>
        <div className="text-center space-y-4 py-8">
          <XCircle className="h-16 w-16 mx-auto text-slate-500" />
          <h1 className="text-2xl font-bold">Demande annulée</h1>
          <p className="text-muted-foreground">Cette demande de signature a été annulée par l'expéditeur.</p>
        </div>
      </CenterCard>
    );
  }

  if (screen.kind === "success") {
    return (
      <CenterCard>
        <div className="text-center space-y-4 py-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-12 w-12 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold">Document signé avec succès</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Votre conseiller a été notifié. Vous recevrez bientôt un email avec une copie du document signé et un accès à votre espace client.
          </p>
        </div>
      </CenterCard>
    );
  }

  if (screen.kind === "refused") {
    return (
      <CenterCard>
        <div className="text-center space-y-4 py-8">
          <XCircle className="h-16 w-16 mx-auto text-red-500" />
          <h1 className="text-2xl font-bold">Signature refusée</h1>
          <p className="text-muted-foreground">Votre conseiller a été informé de votre refus.</p>
        </div>
      </CenterCard>
    );
  }

  // ready or submitting
  const request = screen.request;
  const submitting = screen.kind === "submitting";
  const primaryColor = request.tenant_primary_color || "#1800AD";

  // Build the template data from payload, overriding signatureClient with the live one
  const templateData: MandatTemplateData = {
    ...(request.payload as MandatTemplateData),
    signatureClient,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {request.tenant_logo_url && (
              <img src={request.tenant_logo_url} alt={request.tenant_name || ""} className="h-9 w-auto" />
            )}
            <div>
              <div className="text-xs uppercase text-muted-foreground tracking-wider">Signature électronique</div>
              <div className="font-semibold" style={{ color: primaryColor }}>{request.tenant_name}</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Lien sécurisé
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Title card */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full p-3" style={{ background: `${primaryColor}15` }}>
                <FileSignature className="h-6 w-6" style={{ color: primaryColor }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{documentLabel}</h1>
                <p className="text-muted-foreground mt-1">
                  Veuillez consulter le document ci-dessous, puis signer en bas de page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document preview */}
        {request.document_kind === "mandat_gestion" ? (
          <Card>
            <CardHeader>
              <CardTitle>Aperçu du document</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-4 bg-slate-100">
              <MandatTemplate ref={documentRef} {...templateData} />
            </CardContent>
          </Card>
        ) : request.document_kind === "imported" || request.document_kind === "autre" ? (
          <Card>
            <CardHeader>
              <CardTitle>Aperçu du document</CardTitle>
              {(request.payload as { description?: string })?.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {(request.payload as { description?: string }).description}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {importedPdfLoading && !importedPdfUrl ? (
                <div className="py-8 text-center"><Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" /></div>
              ) : importedPdfUrl ? (
                <iframe
                  src={importedPdfUrl}
                  title="Document à signer"
                  className="w-full h-[700px] rounded border bg-slate-100"
                />
              ) : (
                <Alert variant="destructive">
                  <AlertTitle>Document indisponible</AlertTitle>
                  <AlertDescription>Impossible de charger le document. Contactez votre conseiller.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6">
              <Alert>
                <AlertTitle>Format non encore supporté</AlertTitle>
                <AlertDescription>
                  Ce type de document ne peut pas encore être signé sur cette page. Contactez votre conseiller.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Hidden attestation page for imported documents — used to generate the signed PDF.
             Positioned off-screen so it does not flash to the user. */}
        {(request.document_kind === "imported" || request.document_kind === "autre") && (
          <div style={{ position: "fixed", left: "-99999px", top: 0, width: "210mm", visibility: "hidden", pointerEvents: "none" }} aria-hidden>
            <div
              ref={attestationRef}
              className="bg-white text-black"
              style={{ fontFamily: "Arial, Helvetica, sans-serif", lineHeight: 1.5, width: "190mm", fontSize: "11px", padding: "30px 35px" }}
            >
              <div style={{ borderBottom: `3px solid ${primaryColor}`, paddingBottom: "12px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {request.tenant_logo_url
                  ? <img src={request.tenant_logo_url} alt={request.tenant_name || ""} style={{ height: "40px" }} />
                  : <div style={{ fontWeight: "bold", color: primaryColor, fontSize: "16px" }}>{request.tenant_name}</div>}
                <div style={{ fontSize: "10px", color: "#666" }}>{new Date().toLocaleString("fr-CH")}</div>
              </div>
              <h1 style={{ fontSize: "20px", color: primaryColor, textAlign: "center", marginBottom: "8px" }}>ATTESTATION DE SIGNATURE ÉLECTRONIQUE</h1>
              <div style={{ width: "60px", height: "3px", backgroundColor: primaryColor, margin: "0 auto 20px" }} />

              <div style={{ background: "#f8f9fa", borderRadius: "8px", padding: "16px 20px", marginBottom: "16px" }}>
                <div style={{ fontWeight: "bold", color: primaryColor, marginBottom: "6px" }}>Document signé</div>
                <div style={{ fontSize: "12px" }}>
                  <div><strong>Intitulé :</strong> {documentLabel}</div>
                  <div><strong>Fichier original :</strong> {(request.payload as { originalFileName?: string })?.originalFileName || "—"}</div>
                  <div style={{ wordBreak: "break-all", fontSize: "10px", color: "#666" }}>
                    <strong>Empreinte SHA-256 :</strong> {importedPdfHash || "—"}
                  </div>
                </div>
              </div>

              <div style={{ background: "#f8f9fa", borderRadius: "8px", padding: "16px 20px", marginBottom: "16px" }}>
                <div style={{ fontWeight: "bold", color: primaryColor, marginBottom: "6px" }}>Signataire</div>
                <div style={{ fontSize: "12px" }}>
                  <div><strong>Nom :</strong> {fullName}</div>
                  <div><strong>Date :</strong> {new Date().toLocaleString("fr-CH")}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", marginTop: "24px", marginBottom: "16px" }}>
                <div style={{ textAlign: "center", flex: "0 0 60%" }}>
                  <div style={{ height: "100px", border: `2px dashed ${primaryColor}`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px", background: "#fafafa" }}>
                    {signatureClient && <img src={signatureClient} alt="Signature" style={{ maxHeight: "90px", maxWidth: "100%", objectFit: "contain" }} />}
                  </div>
                  <div style={{ borderTop: `2px solid ${primaryColor}`, paddingTop: "6px" }}>
                    <div style={{ fontWeight: "bold", color: primaryColor, fontSize: "12px" }}>{fullName}</div>
                    <div style={{ fontSize: "10px", color: "#666" }}>Signataire</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "20px", fontSize: "9px", color: "#666", lineHeight: 1.6, padding: "12px", background: "#fffbeb", borderLeft: `3px solid #f59e0b`, borderRadius: "4px" }}>
                <strong>Note légale :</strong> cette attestation constitue une signature électronique simple (SES) au sens du droit suisse.
                L'empreinte cryptographique SHA-256 ci-dessus garantit l'intégrité du document signé : toute modification ultérieure
                du fichier original modifierait cette empreinte. Adresse IP, navigateur et horodatage sont enregistrés à des fins de traçabilité.
              </div>
              <div style={{ marginTop: "16px", textAlign: "center", fontSize: "9px", color: "#999" }}>
                Document généré par {request.tenant_name} via la plateforme LYTA
              </div>
            </div>
          </div>
        )}

        {/* Signature form */}
        {!refusalMode ? (
          <Card>
            <CardHeader>
              <CardTitle>Votre signature</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="full-name">Votre nom complet</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Prénom Nom"
                  disabled={submitting}
                  maxLength={200}
                />
              </div>

              <SignaturePad
                label="Signez dans le cadre"
                onSignatureChange={setSignatureClient}
                signature={signatureClient}
              />

              <div className="flex items-start gap-2">
                <Checkbox
                  id="accept"
                  checked={accepted}
                  onCheckedChange={(v) => setAccepted(v === true)}
                  disabled={submitting}
                />
                <Label htmlFor="accept" className="text-sm leading-snug cursor-pointer">
                  Je confirme avoir lu, compris et accepté le contenu du document ci-dessus.
                  Je reconnais que ma signature électronique a la même valeur juridique qu'une signature manuscrite (signature électronique simple).
                </Label>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !signatureClient || !accepted || fullName.trim().length < 3}
                  className="gap-2"
                  style={{ background: primaryColor }}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {submitting ? "Envoi en cours…" : "Confirmer et signer"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setRefusalMode(true)}
                  disabled={submitting}
                >
                  Refuser de signer
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                En signant, vous consentez à ce que votre adresse IP, navigateur et horodatage soient enregistrés à des fins de traçabilité.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Refuser de signer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Si vous ne souhaitez pas signer ce document, vous pouvez nous indiquer la raison (facultatif).
                Votre conseiller sera notifié.
              </p>
              <Textarea
                value={refusalReason}
                onChange={(e) => setRefusalReason(e.target.value)}
                placeholder="Motif du refus (facultatif)"
                rows={4}
                maxLength={500}
                disabled={submitting}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleRefuse}
                  disabled={submitting}
                  variant="destructive"
                  className="gap-2"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  {submitting ? "Envoi en cours…" : "Confirmer le refus"}
                </Button>
                <Button variant="ghost" onClick={() => setRefusalMode(false)} disabled={submitting}>
                  Retour
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-8 text-center text-xs text-muted-foreground">
        Plateforme de signature sécurisée — Lyta CRM
      </footer>
    </div>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-lg w-full">
        <Card>
          <CardContent className="py-8">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
