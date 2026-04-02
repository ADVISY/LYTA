import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useSessionTimeout(timeoutMinutes: number | null) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const handleExpiration = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Session may already be invalid
    }
    toast({
      title: "Session expirée",
      description: "Vous avez été déconnecté pour inactivité.",
      variant: "destructive",
    });
    navigate("/connexion");
  }, [navigate, toast]);

  const resetTimer = useCallback(() => {
    if (!timeoutMinutes || timeoutMinutes <= 0) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const timeoutMs = timeoutMinutes * 60 * 1000;
    timerRef.current = setTimeout(handleExpiration, timeoutMs);
  }, [timeoutMinutes, handleExpiration]);

  useEffect(() => {
    if (!timeoutMinutes || timeoutMinutes <= 0) return;

    // Debounce activity tracking to every 30 seconds
    const DEBOUNCE_MS = 30_000;

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current >= DEBOUNCE_MS) {
        lastActivityRef.current = now;
        resetTimer();
      }
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the timer
    resetTimer();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeoutMinutes, resetTimer]);
}
