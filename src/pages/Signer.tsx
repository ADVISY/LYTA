// Public signing page accessed via /signer/:token. Does NOT require authentication.
// Loads the signature request via an RPC, lets the client review the document, sign,
// then posts the final PDF to the complete-signature edge function.
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import html2pdf from "html2pdf.js";
import { PDFDocument, StandardFonts } from "pdf-lib";
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

  // Where on the imported PDF to stamp the signature.
  //   page : "last" (most contracts), "first" (some declarations sign at top)
  //   anchor : a 3×3 grid keyword. Default bottom-right matches the historical
  //            placement Habib confirmed was good — the grid lets the client
  //            move it for documents with different layouts (e.g. a form
  //            where the signature line is centered or top-left).
  type SignatureAnchor =
    | "top-left" | "top-center" | "top-right"
    | "middle-left" | "middle-center" | "middle-right"
    | "bottom-left" | "bottom-center" | "bottom-right";
  type SignaturePagePick = "first" | "last";
  const [signaturePage, setSignaturePage] = useState<SignaturePagePick>("last");
  const [signatureAnchor, setSignatureAnchor] = useState<SignatureAnchor>("bottom-right");

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

  /**
   * Convert a binary buffer to base64 in 32 KB chunks (avoids the
   * "argument list too long" error you get from spreading a 5 MB PDF
   * through String.fromCharCode in one shot).
   */
  const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    return btoa(binary);
  };

  const generateSignedPdfBase64 = async (): Promise<string> => {
    if (screen.kind !== "ready" && screen.kind !== "submitting") {
      throw new Error("État invalide");
    }
    const r = screen.request;
    const isImported = r.document_kind === "imported" || r.document_kind === "autre";

    const opt = {
      margin: [8, 10, 8, 10] as [number, number, number, number],
      filename: "document_signe.pdf",
      image: { type: "jpeg" as const, quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false },
      jsPDF: { unit: "mm" as const, format: "a4", orientation: "portrait" as const },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    // ---------------- Mandat path (unchanged) ----------------
    if (!isImported) {
      const target = documentRef.current;
      if (!target) throw new Error("Aperçu indisponible");
      const blob: Blob = await html2pdf().set(opt).from(target).output("blob");
      return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
    }

    // ---------------- Imported document path ----------------
    // The previous implementation only sent the attestation certificate
    // as the "signed PDF" — the original document the client read was
    // not bundled, which made the signature legally hollow (the client
    // had nothing tying their signature to the document content).
    //
    // New behaviour:
    //   1. Fetch the original imported PDF the client just reviewed.
    //   2. Stamp the client's signature image on the bottom-right of
    //      the last page (so the document itself is visibly signed).
    //   3. Append the attestation certificate (existing HTML page)
    //      as the trailing page(s) — preserves the SHA-256 hash of
    //      the ORIGINAL doc + IP + timestamp + legal note.
    //   4. Return the merged PDF as a single base64 blob.
    if (!attestationRef.current) throw new Error("Attestation indisponible");
    if (!importedPdfUrl) throw new Error("Document original indisponible");
    if (!signatureClient) throw new Error("Signature manquante");

    // 1. Generate the attestation page(s) as a PDF blob via html2pdf
    const attestationBlob: Blob = await html2pdf()
      .set(opt)
      .from(attestationRef.current)
      .output("blob");
    const attestationBytes = new Uint8Array(await attestationBlob.arrayBuffer());

    // 2. Fetch the original PDF bytes
    const origResp = await fetch(importedPdfUrl);
    if (!origResp.ok) throw new Error("Téléchargement du PDF original échoué");
    const origBytes = new Uint8Array(await origResp.arrayBuffer());

    // 3. Load both with pdf-lib
    let origDoc: PDFDocument;
    try {
      origDoc = await PDFDocument.load(origBytes, { ignoreEncryption: true });
    } catch (err) {
      throw new Error(
        "Le PDF original n'a pas pu être lu (peut-être protégé par mot de passe ou corrompu).",
      );
    }
    const attestDoc = await PDFDocument.load(attestationBytes);

    // 4. Stamp the signature image on the bottom-right of the last page
    //    of the original document. signatureClient is a base64 data URL
    //    produced by SignaturePad ("data:image/png;base64,…").
    const dataUrlMatch = signatureClient.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!dataUrlMatch) throw new Error("Format de signature invalide");
    const isPng = dataUrlMatch[1] === "png";
    const sigB64 = dataUrlMatch[2];
    const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const sigImage = isPng
      ? await origDoc.embedPng(sigBytes)
      : await origDoc.embedJpg(sigBytes);

    const helveticaFont = await origDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await origDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = origDoc.getPages();
    // Pick the page the client chose: "first" or "last". We never let
    // the user pick a middle page from the UI to keep it simple — most
    // Swiss broker docs only need first or last anyway.
    const targetPage = pages[signaturePage === "first" ? 0 : pages.length - 1];
    const { width: pageW, height: pageH } = targetPage.getSize();

    // Compute sig box dimensions: max ~35% of page width, max 60pt
    // height, natural aspect ratio preserved.
    const naturalDims = sigImage.scale(1);
    const targetW = Math.min(pageW * 0.35, 160);
    const scaleFactor = targetW / naturalDims.width;
    const drawnW = naturalDims.width * scaleFactor;
    const drawnH = Math.min(naturalDims.height * scaleFactor, 60);

    // Translate the 3×3 anchor into actual page coordinates.
    // pdf-lib origin is BOTTOM-LEFT, so y increases going up.
    const margin = 30;
    const captionSpace = 24; // room below for "Signé par … / date"
    const [vAnchor, hAnchor] = signatureAnchor.split("-") as [
      "top" | "middle" | "bottom",
      "left" | "center" | "right",
    ];

    let baseX: number;
    if (hAnchor === "left") baseX = margin;
    else if (hAnchor === "center") baseX = (pageW - drawnW) / 2;
    else baseX = pageW - drawnW - margin;

    let baseY: number;
    if (vAnchor === "bottom") baseY = margin + captionSpace;
    else if (vAnchor === "middle") baseY = (pageH - drawnH) / 2;
    else baseY = pageH - drawnH - margin;

    targetPage.drawImage(sigImage, {
      x: baseX,
      y: baseY,
      width: drawnW,
      height: drawnH,
    });

    // Caption below the signature
    const caption1 = `Signé par ${fullName || ""}`;
    const caption2 = new Date().toLocaleString("fr-CH");
    targetPage.drawText(caption1, {
      x: baseX,
      y: baseY - 10,
      size: 8,
      font: helveticaBold,
    });
    targetPage.drawText(caption2, {
      x: baseX,
      y: baseY - 20,
      size: 7,
      font: helveticaFont,
    });

    // 5. Append the attestation pages to the merged document
    const attestPages = await origDoc.copyPages(attestDoc, attestDoc.getPageIndices());
    attestPages.forEach((p) => origDoc.addPage(p));

    // 6. Serialise & return
    const merged = await origDoc.save();
    return bytesToBase64(merged);
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
      // eslint-disable-next-line no-console
      console.log("[Signer] generating signed PDF…");
      const signedPdfBase64 = await generateSignedPdfBase64();
      // eslint-disable-next-line no-console
      console.log("[Signer] signed PDF generated", {
        base64Length: signedPdfBase64.length,
        approxBytes: Math.round((signedPdfBase64.length * 3) / 4),
      });

      await callCompleteSignature({
        token,
        signedPdfBase64,
        clientSignatureImage: signatureClient,
        clientFullName: fullName.trim(),
      });

      setScreen({ kind: "success" });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Signer] handleSubmit failed", err);
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
                <div className="space-y-3">
                  {/*
                    Use <object> rather than <iframe>: browsers (especially
                    Chrome) frequently render a blank frame for PDFs served
                    from cross-origin signed URLs because of X-Frame-Options
                    or PDF-viewer policies. <object> falls back gracefully
                    to its inner content (the "open in new tab" link below)
                    when the inline render fails.
                  */}
                  <object
                    data={importedPdfUrl}
                    type="application/pdf"
                    className="w-full h-[700px] rounded border bg-slate-100"
                    aria-label="Document à signer"
                  >
                    <div className="p-6 bg-amber-50 border border-amber-200 rounded text-sm space-y-3">
                      <p className="font-semibold text-amber-900">
                        L'aperçu PDF n'a pas pu s'afficher dans cette fenêtre.
                      </p>
                      <p className="text-amber-800">
                        Cliquez sur le bouton ci-dessous pour ouvrir le document
                        dans un nouvel onglet, lisez-le attentivement, puis
                        revenez ici pour signer.
                      </p>
                      <a
                        href={importedPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
                      >
                        Ouvrir le document dans un nouvel onglet
                      </a>
                    </div>
                  </object>
                  {/* Always-visible secondary link in case <object> renders but
                      the user wants the document larger / printable. */}
                  <div className="text-xs text-muted-foreground text-right">
                    <a
                      href={importedPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      Ouvrir dans un nouvel onglet ↗
                    </a>
                  </div>
                </div>
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

        {/*
          Signature placement picker — only for imported PDFs (mandat de
          gestion has its own template with built-in signature slots).
          Lets the client choose which page (first/last) and which of
          9 grid positions the signature image is stamped at, instead
          of always defaulting to bottom-right.
        */}
        {!refusalMode && (request.document_kind === "imported" || request.document_kind === "autre") && (
          <Card>
            <CardHeader>
              <CardTitle>Position de votre signature</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Choisissez où votre signature apparaîtra sur le document.
                Par défaut : bas à droite de la dernière page.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Page selector */}
              <div className="space-y-2">
                <Label>Page</Label>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "last", label: "Dernière page" },
                      { value: "first", label: "Première page" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={submitting}
                      onClick={() => setSignaturePage(opt.value)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                        signaturePage === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3×3 grid representing the page */}
              <div className="space-y-2">
                <Label>Emplacement sur la page</Label>
                <div className="flex items-start gap-4">
                  <div
                    className="aspect-[210/297] w-44 shrink-0 border-2 border-slate-300 rounded-md p-2 bg-slate-50"
                    aria-label="Aperçu de la page"
                  >
                    <div className="h-full grid grid-cols-3 grid-rows-3 gap-1">
                      {(
                        [
                          "top-left", "top-center", "top-right",
                          "middle-left", "middle-center", "middle-right",
                          "bottom-left", "bottom-center", "bottom-right",
                        ] as const
                      ).map((a) => {
                        const selected = signatureAnchor === a;
                        return (
                          <button
                            key={a}
                            type="button"
                            disabled={submitting}
                            onClick={() => setSignatureAnchor(a)}
                            aria-label={a}
                            className={`rounded flex items-center justify-center transition-all text-xs ${
                              selected
                                ? "bg-primary text-primary-foreground ring-2 ring-primary"
                                : "bg-white border border-slate-200 hover:border-primary hover:bg-primary/5"
                            }`}
                          >
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1 mt-1">
                    <div>
                      <span className="font-medium text-foreground">
                        Position sélectionnée :
                      </span>{" "}
                      {(() => {
                        const labels: Record<typeof signatureAnchor, string> = {
                          "top-left": "Haut gauche",
                          "top-center": "Haut centre",
                          "top-right": "Haut droite",
                          "middle-left": "Milieu gauche",
                          "middle-center": "Milieu centre",
                          "middle-right": "Milieu droite",
                          "bottom-left": "Bas gauche",
                          "bottom-center": "Bas centre",
                          "bottom-right": "Bas droite",
                        };
                        return labels[signatureAnchor];
                      })()}
                    </div>
                    <div className="text-xs">
                      sur la {signaturePage === "first" ? "première" : "dernière"} page
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
