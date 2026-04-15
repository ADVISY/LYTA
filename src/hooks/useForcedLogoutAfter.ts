import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  clearSessionEnforcerState,
  readSessionEnforcerState,
  writeSessionEnforcerState,
} from "@/lib/sessionEnforcerStorage";

export function useForcedLogoutAfter(durationMinutes: number | null) {
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSigningOutRef = useRef(false);
  const lastActivityRef = useRef(0);
  const lastPersistedActivityRef = useRef(0);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!durationMinutes || durationMinutes <= 0) {
      return;
    }

    if (loading) {
      return;
    }

    if (!user) {
      clearSessionEnforcerState();
      isSigningOutRef.current = false;
      return;
    }

    const durationMs = durationMinutes * 60 * 1000;
    const storedState = readSessionEnforcerState();
    const sessionState =
      storedState && storedState.userId === user.id
        ? storedState
        : { lastActivityAt: Date.now(), userId: user.id };

    writeSessionEnforcerState(sessionState);
    lastActivityRef.current = sessionState.lastActivityAt;
    lastPersistedActivityRef.current = sessionState.lastActivityAt;

    const forceLogout = async () => {
      if (isSigningOutRef.current) return;
      isSigningOutRef.current = true;

      toast({
        title: "Session expirée",
        description: "Vous avez été déconnecté automatiquement après une période d'inactivité.",
        variant: "destructive",
      });

      await signOut();
    };

    const scheduleLogout = (lastActivityAt: number) => {
      const remainingMs = durationMs - (Date.now() - lastActivityAt);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (remainingMs <= 0) {
        void forceLogout();
        return;
      }

      timerRef.current = setTimeout(() => {
        void forceLogout();
      }, remainingMs);
    };

    const recordActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      scheduleLogout(now);

      if (now - lastPersistedActivityRef.current >= 15000) {
        lastPersistedActivityRef.current = now;
        writeSessionEnforcerState({
          userId: user.id,
          lastActivityAt: now,
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        recordActivity();
      }
    };

    scheduleLogout(lastActivityRef.current);

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "focus",
      "touchstart",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [durationMinutes, loading, signOut, toast, user]);
}
