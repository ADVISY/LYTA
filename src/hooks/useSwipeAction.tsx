/**
 * useSwipeAction — Hook pour gérer un swipe horizontal (souris + tactile).
 *
 * Usage :
 *   const { ref, dragX, isSwipingLeft, isSwipingRight } = useSwipeAction({
 *     onSwipeLeft: () => deleteNotif(),
 *     onSwipeRight: () => convertToTask(),
 *     threshold: 80,
 *   });
 *
 *   <div ref={ref} style={{ transform: `translateX(${dragX}px)` }}>...</div>
 */
import { useEffect, useRef, useState, useCallback } from "react";

export interface UseSwipeActionOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // distance en px pour déclencher l'action
  disabled?: boolean;
}

export interface UseSwipeActionReturn {
  ref: React.MutableRefObject<HTMLDivElement | null>;
  dragX: number;
  isDragging: boolean;
  isSwipingLeft: boolean;
  isSwipingRight: boolean;
  reset: () => void;
}

export function useSwipeAction({
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
  disabled = false,
}: UseSwipeActionOptions): UseSwipeActionReturn {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const wasDraggedRef = useRef(false); // pour distinguer click vs drag

  const reset = useCallback(() => {
    setDragX(0);
    setIsDragging(false);
    startXRef.current = 0;
  }, []);

  const handleStart = useCallback(
    (clientX: number) => {
      if (disabled) return;
      startXRef.current = clientX;
      setIsDragging(true);
      wasDraggedRef.current = false;
    },
    [disabled]
  );

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging || disabled) return;
      const delta = clientX - startXRef.current;
      // Clamp pour éviter des valeurs absurdes
      const clamped = Math.max(-200, Math.min(200, delta));
      setDragX(clamped);
      if (Math.abs(clamped) > 5) wasDraggedRef.current = true;
    },
    [isDragging, disabled]
  );

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX > threshold) {
      onSwipeRight?.();
      reset();
    } else if (dragX < -threshold) {
      onSwipeLeft?.();
      reset();
    } else {
      // Pas assez loin → revient à 0
      setDragX(0);
    }
  }, [isDragging, dragX, threshold, onSwipeLeft, onSwipeRight, reset]);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    // ─── Souris ───────────────────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      handleStart(e.clientX);
    };
    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };
    const onMouseUp = () => {
      handleEnd();
    };

    // ─── Tactile (mobile) ─────────────────────────────────────────
    const onTouchStart = (e: TouchEvent) => {
      handleStart(e.touches[0].clientX);
    };
    const onTouchMove = (e: TouchEvent) => {
      handleMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => {
      handleEnd();
    };

    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    // Move + Up : on écoute window pour rester actif même si la souris
    // sort de l'élément pendant le drag
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [handleStart, handleMove, handleEnd, disabled]);

  return {
    ref,
    dragX,
    isDragging,
    isSwipingLeft: dragX < -threshold * 0.5,
    isSwipingRight: dragX > threshold * 0.5,
    reset,
  };
}
