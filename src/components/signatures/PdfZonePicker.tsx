/**
 * PdfZonePicker
 * =============
 * Affiche un PDF en preview et permet au broker de dessiner UNE zone de
 * signature en draguant la souris. Le rectangle peut être redessiné
 * autant de fois que voulu (chaque drag remplace la zone précédente).
 *
 * Coordonnées retournées : normalisées 0-1 par rapport à la page entière,
 * pour rester responsive et indépendantes de la taille d'affichage.
 *
 * Approche minimaliste : <iframe src={pdfUrl}> pour le rendu PDF natif
 * (navigateur intégré, zéro lib supplémentaire). Overlay <div> par-dessus
 * pour capturer le drag. Pour 1 zone sur 1 page (cas d'usage actuel),
 * c'est suffisant.
 *
 * Limites assumées :
 *   - Une seule page de PDF "visible" par picker (page 1 par défaut)
 *   - Pas de zoom (le navigateur gère l'affichage natif)
 *   - Pour multi-pages, le broker peut scroller dans l'iframe mais la
 *     zone n'est attachée qu'à la page courante au moment du drag
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SignatureZone {
  page: number;       // 1-based, par défaut 1
  x: number;          // 0-1, gauche du rectangle / largeur du PDF
  y: number;          // 0-1, haut du rectangle / hauteur du PDF (origine top-left UI)
  width: number;      // 0-1
  height: number;     // 0-1
}

interface PdfZonePickerProps {
  pdfUrl: string;
  zone: SignatureZone | null;
  onChange: (zone: SignatureZone | null) => void;
  /** Page sur laquelle la zone est ancrée (1-based). Default 1. */
  page?: number;
}

interface DragState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  dragging: boolean;
}

export function PdfZonePicker({ pdfUrl, zone, onChange, page = 1 }: PdfZonePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  // Normalise des coords pixels du container en coords 0-1
  const toNormalized = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
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
    // Trop petit = on ignore (clic accidentel)
    if (w < 0.02 || h < 0.01) {
      setDrag(null);
      return;
    }
    onChange({
      page,
      x: Math.min(drag.startX, drag.endX),
      y: Math.min(drag.startY, drag.endY),
      width: w,
      height: h,
    });
    setDrag(null);
  };

  // Rectangle d'aperçu (drag en cours OU zone finalisée)
  const previewRect = drag?.dragging
    ? {
        left: `${Math.min(drag.startX, drag.endX) * 100}%`,
        top: `${Math.min(drag.startY, drag.endY) * 100}%`,
        width: `${Math.abs(drag.endX - drag.startX) * 100}%`,
        height: `${Math.abs(drag.endY - drag.startY) * 100}%`,
      }
    : zone
    ? {
        left: `${zone.x * 100}%`,
        top: `${zone.y * 100}%`,
        width: `${zone.width * 100}%`,
        height: `${zone.height * 100}%`,
      }
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <MousePointer2 className="h-4 w-4" />
          {zone
            ? "Zone définie. Tu peux redessiner pour la déplacer."
            : "Drague la souris sur le document pour dessiner la zone où le client doit signer."}
        </p>
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

      <div
        ref={containerRef}
        className="relative w-full bg-muted/30 border-2 border-dashed border-border rounded-lg overflow-hidden"
        style={{ height: 600 }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* PDF preview (native browser viewer) */}
        <iframe
          src={`${pdfUrl}#page=${page}&toolbar=0&navpanes=0`}
          title="Document à signer"
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Overlay transparent qui capture les events */}
        <div className="absolute inset-0 cursor-crosshair" />

        {/* Rectangle de la zone (en cours OU final) */}
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
