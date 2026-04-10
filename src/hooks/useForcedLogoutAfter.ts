import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  clearSessionEnforcerState,
  readSessionEnforcerState,
  writeSessionEnforcerState,
} from "@/lib/sessionEnforcerStorage";

export function useForcedLogoutAfter(durationMinutes: number) {
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSigningOutRef = useRef(false);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (loading) {
      return;
    }

    if (!user) {
      clearSessionEnforcerState();
      isSigningOutRef.current = false;
      return;
    }

    const now = Date.now();
    const durationMs = durationMinutes * 60 * 1000;
    const storedState = readSessionEnforcerState();
    const sessionState =
      storedState && storedState.userId === user.id
        ? storedState
        : { startedAt: now, userId: user.id };

    writeSessionEnforcerState(sessionState);

    const elapsedMs = now - sessionState.startedAt;
    const remainingMs = durationMs - elapsedMs;

    const forceLogout = async () => {
      if (isSigningOutRef.current) return;
      isSigningOutRef.current = true;

      toast({
        title: "Session expirée",
        description: "Vous avez été déconnecté automatiquement après 1 heure.",
        variant: "destructive",
      });

      await signOut();
    };

    if (remainingMs <= 0) {
      void forceLogout();
      return;
    }

    timerRef.current = setTimeout(() => {
      void forceLogout();
    }, remainingMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [durationMinutes, loading, signOut, toast, user]);
}
