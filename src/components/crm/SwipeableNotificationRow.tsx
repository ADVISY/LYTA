/**
 * SwipeableNotificationRow — Wrapper avec swipe gauche/droite sur une notif.
 *
 * Swipe gauche (vers la gauche) → action "delete" (rouge derrière)
 * Swipe droite (vers la droite) → action "convertir en tâche" (vert derrière)
 *
 * Marche avec souris (drag & drop) ET tactile (mobile).
 */
import { ReactNode } from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { useSwipeAction } from "@/hooks/useSwipeAction";
import { cn } from "@/lib/utils";

interface SwipeableNotificationRowProps {
  children: ReactNode;
  onSwipeRight?: () => void;   // ex: convertir en tâche
  onSwipeLeft?: () => void;    // ex: supprimer
  disabled?: boolean;
}

export function SwipeableNotificationRow({
  children,
  onSwipeRight,
  onSwipeLeft,
  disabled = false,
}: SwipeableNotificationRowProps) {
  const { ref, dragX, isDragging, isSwipingLeft, isSwipingRight } = useSwipeAction({
    onSwipeLeft,
    onSwipeRight,
    threshold: 80,
    disabled,
  });

  return (
    <div className="relative overflow-hidden">
      {/* Fond "convertir en tâche" (vert, révélé en swipe droite) */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex items-center px-4 bg-emerald-500 text-white transition-opacity",
          isSwipingRight ? "opacity-100" : "opacity-30"
        )}
        style={{ width: Math.max(0, dragX) }}
      >
        <UserPlus className="h-4 w-4 flex-shrink-0" />
        {isSwipingRight && (
          <span className="ml-2 text-xs font-medium whitespace-nowrap">
            Convertir en tâche
          </span>
        )}
      </div>

      {/* Fond "supprimer" (rouge, révélé en swipe gauche) */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-red-500 text-white transition-opacity",
          isSwipingLeft ? "opacity-100" : "opacity-30"
        )}
        style={{ width: Math.max(0, -dragX) }}
      >
        {isSwipingLeft && (
          <span className="mr-2 text-xs font-medium whitespace-nowrap">
            Supprimer
          </span>
        )}
        <Trash2 className="h-4 w-4 flex-shrink-0" />
      </div>

      {/* Contenu draggable */}
      <div
        ref={ref}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform 200ms ease-out",
          touchAction: "pan-y",  // permet le scroll vertical pendant qu'on swipe horizontal
          userSelect: "none",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        className="relative bg-card"
      >
        {children}
      </div>
    </div>
  );
}
