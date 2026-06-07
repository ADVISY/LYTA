/**
 * PdfZonePicker
 * =============
 * Affiche un PDF en preview (canvas via pdfjs-dist) et permet au broker
 * de dessiner UNE zone de signature en draguant la souris.
 *
 * Pourquoi canvas et pas iframe : le browser bloque souvent l'affichage
 * des PDFs en blob URLs dans une iframe (X-Frame-Options, CSP, viewer
 * policy). Le rendu via canvas pdfjs-dist marche partout : Chrome,
 * Safari, Firefox, mobile.
 *
 * Coordonnées retournées : normalisées 0-1 par rapport à la page entière.
 *
 * Limites assumées :
 *   - 1 zone par doc (la dernière drague remplace la précédente)
 *   - 1 page visible à la fois (navigation Précédent / Suivant)
 *   - Page de la zone = page courante au moment du drag
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, MousePointer2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import * as pdfjs from "pdfjs-dist";

// Worker config : on charge le worker depuis le CDN officiel pour éviter
// les soucis de bundling (le worker doit être servi en .mjs).
pdfjs.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface SignatureZone {
  page: number;       // 1-based
  x: number;          // 0-1
  y: number;          // 0-1 (origine top-left UI)
  width: number;      // 0-1
  height: number;     // 0-1
}

interface PdfZonePickerProps {
  pdfUrl: string;
  zone: SignatureZone | null;
  onChange: (zone: SignatureZone | null) => void;
}

interface DragState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  dragging: boolean;
}

export function PdfZonePicker({ pdfUrl, zone, onChange }: PdfZonePickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rendering, setRendering] = useState(true);
  const [drag, setDrag] = useState<DragState | null>(null);

  // ─── Charge le PDF ──────────────────────────────────────────────
  useEffect(() => {
    let aborted = false;
    setRendering(true);
    pdfjs.getDocument(pdfUrl).promise
      .then((doc) => {
        if (aborted) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
      })
      .catch((err) => {
        console.error("[PdfZonePicker] failed to load PDF", err);
      });
    return () => { aborted = true; };
  }, [pdfUrl]);

  // ─── Rend la page courante dans le canvas ──────────────────────
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let aborted = false;
    setRendering(true);
    (async () => {
      try {
        const page = await pdf.getPage(currentPage);
        if (aborted) return;
        const viewport = page.getViewport({ scale: 1 });

        // Calcule la largeur cible pour fit le container (max 800px)
        const containerWidth = containerRef.current?.clientWidth ?? 800;
        const scale = Math.min(2, containerWidth / viewport.width);
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        canvas.style.width = "100%";
        canvas.style.height = "auto";

        await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas }).promise;
      } catch (err) {
        console.error("[PdfZonePicker] render error", err);
      } finally {
        if (!aborted) setRendering(false);
      }
    })();
    return () => { aborted = true; };
  }, [pdf, currentPage]);

  // Normalise les coords pixels du canvas en coords 0-1 (par rapport à
  // la taille affichée, pas à la résolution interne du canvas).
  const toNormalized = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setDrag({ startX: x, startY: y, endX: x, endY: y, dragging: true });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag?.dragging) return;
    const { x, y } = toNormalized(e.clientX, e.clientY);
    setDrag({ ...drag, endX: x, endY: y });
  };

  const onMouseUp = () => {
    if (!drag?.dragging) return;
    const w = Math.abs(drag.endX - drag.startX);
    const h = Math.abs(drag.endY - drag.startY);
    if (w < 0.02 || h < 0.01) {
      setDrag(null);
      return;
    }
    onChange({
      page: currentPage,
      x: Math.min(drag.startX, drag.endX),
      y: Math.min(drag.startY, drag.endY),
      width: w,
      height: h,
    });
    setDrag(null);
  };

  // Rectangle d'aperçu — visible uniquement si on est sur la même page
  // que celle où la zone est ancrée.
  const zoneOnCurrentPage = zone && zone.page === currentPage ? zone : null;
  const previewRect = drag?.dragging
    ? {
        left: `${Math.min(drag.startX, drag.endX) * 100}%`,
        top: `${Math.min(drag.startY, drag.endY) * 100}%`,
        width: `${Math.abs(drag.endX - drag.startX) * 100}%`,
        height: `${Math.abs(drag.endY - drag.startY) * 100}%`,
      }
    : zoneOnCurrentPage
    ? {
        left: `${zoneOnCurrentPage.x * 100}%`,
        top: `${zoneOnCurrentPage.y * 100}%`,
        width: `${zoneOnCurrentPage.width * 100}%`,
        height: `${zoneOnCurrentPage.height * 100}%`,
      }
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <MousePointer2 className="h-4 w-4" />
          {zone
            ? `Zone définie page ${zone.page}. Redessine pour la déplacer.`
            : "Drague la souris sur le document pour dessiner la zone de signature."}
        </p>
        <div className="flex items-center gap-2">
          {numPages > 1 && (
            <div className="flex items-center gap-1 text-xs">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium px-1">
                Page {currentPage} / {numPages}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage === numPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          {zone && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Effacer
            </Button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full bg-muted/30 border rounded-lg overflow-hidden"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: rendering ? "wait" : "crosshair" }}
      >
        <canvas ref={canvasRef} className="block w-full" />

        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {previewRect && (
          <div
            className={cn(
              "absolute border-2 pointer-events-none transition-colors",
              drag?.dragging
                ? "border-primary bg-primary/10"
                : "border-emerald-500 bg-emerald-500/15 shadow-lg"
            )}
            style={previewRect}
          >
            {!drag?.dragging && (
              <div className="absolute -top-7 left-0 bg-emerald-600 text-white text-xs font-medium px-2 py-1 rounded shadow-md whitespace-nowrap">
                ✍️ Signez ici
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
