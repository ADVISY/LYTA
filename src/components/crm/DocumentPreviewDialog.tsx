/**
 * DocumentPreviewDialog — Aperçu inline d'un document dans une modale.
 *
 * Pourquoi : avant, cliquer sur l'icône "Eye" dans la liste docs d'une fiche
 * client ouvrait un nouvel onglet sur un signed URL. UX cassée : on quitte
 * le contexte de la fiche, on doit ensuite revenir, et sur mobile c'est pire
 * (popup blocker, gestion onglets).
 *
 * Cette modale rend l'aperçu directement dans la page :
 *   - PDF      → <iframe> sur le signed URL (le navigateur gère la pagination)
 *   - Image    → <img> direct (PNG, JPG, WEBP, HEIC/HEIF si supporté navigateur)
 *   - Autre    → message "Aperçu indisponible" + bouton Télécharger
 *
 * Le signed URL est généré au mount (TTL 1h) puis stocké dans state. Si la
 * modale reste ouverte > 1h, l'URL expire — pas grave, on ferme/rouvre.
 *
 * Actions exposées :
 *   - Télécharger (toujours) : utilise le même signed URL + attribut `download`
 *   - Ouvrir dans un nouvel onglet (fallback si rendu inline foireux)
 *   - Renommer / Dupliquer : optionnels, branchés par le parent via callbacks
 *
 * Ne dépend de rien de spécifique à la fiche client → réutilisable partout
 * où on liste des documents (signatures, scans, contrats, etc.).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Download,
  ExternalLink,
  FileText,
  AlertCircle,
  Pencil,
  Copy,
} from "lucide-react";

export interface DocumentPreviewDoc {
  id: string;
  file_key: string;
  file_name: string;
  mime_type?: string | null;
}

export interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DocumentPreviewDoc | null;
  /** Bucket Supabase storage. Default 'documents'. */
  bucket?: string;
  /** Optional : bouton Renommer. Si absent, le bouton n'apparaît pas. */
  onRename?: (doc: DocumentPreviewDoc) => void;
  /** Optional : bouton Dupliquer vers un autre client. */
  onDuplicate?: (doc: DocumentPreviewDoc) => void;
}

/** Devine le type d'aperçu à partir de mime_type ou de l'extension. */
function detectPreviewKind(
  mimeType: string | null | undefined,
  fileName: string
): "pdf" | "image" | "other" {
  const mt = (mimeType || "").toLowerCase();
  if (mt.startsWith("image/")) return "image";
  if (mt === "application/pdf") return "pdf";

  // Fallback extension
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "gif", "heic", "heif"].includes(ext)) {
    return "image";
  }
  if (ext === "pdf") return "pdf";
  return "other";
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  doc,
  bucket = "documents",
  onRename,
  onDuplicate,
}: DocumentPreviewDialogProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Génère un signed URL fresh à chaque ouverture (TTL 1h)
  useEffect(() => {
    if (!open || !doc) {
      setSignedUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error: err } = await supabase.storage
          .from(bucket)
          .createSignedUrl(doc.file_key, 3600);
        if (cancelled) return;
        if (err) throw err;
        if (!data?.signedUrl) throw new Error("Signed URL vide");
        setSignedUrl(data.signedUrl);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "Impossible de générer l'aperçu"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, doc, bucket]);

  if (!doc) return null;

  const kind = detectPreviewKind(doc.mime_type, doc.file_name);

  const handleDownload = () => {
    if (!signedUrl) return;
    // Astuce : on force download via <a download> au lieu d'ouvrir dans onglet
    const a = document.createElement("a");
    a.href = signedUrl;
    a.download = doc.file_name;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
            <DialogTitle className="text-base font-medium truncate">
              {doc.file_name}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onRename && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRename(doc)}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Renommer</span>
              </Button>
            )}
            {onDuplicate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDuplicate(doc)}
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dupliquer</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={!signedUrl}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Télécharger</span>
            </Button>
            {signedUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(signedUrl, "_blank")}
                className="gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Onglet</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-[60vh] bg-muted/30 overflow-hidden flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Chargement de l'aperçu…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 text-destructive max-w-md text-center px-6">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && signedUrl && kind === "pdf" && (
            <iframe
              src={signedUrl}
              title={doc.file_name}
              className="w-full h-full border-0"
              // sandbox volontairement non restreint pour laisser le viewer PDF natif fonctionner
            />
          )}

          {!loading && !error && signedUrl && kind === "image" && (
            <img
              src={signedUrl}
              alt={doc.file_name}
              className="max-w-full max-h-full object-contain"
            />
          )}

          {!loading && !error && signedUrl && kind === "other" && (
            <div className="flex flex-col items-center gap-4 text-center px-6">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium">Aperçu indisponible</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ce type de fichier ne peut pas être prévisualisé directement
                  ({doc.mime_type || "type inconnu"}). Téléchargez-le pour
                  l'ouvrir.
                </p>
              </div>
              <Button onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Télécharger
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
