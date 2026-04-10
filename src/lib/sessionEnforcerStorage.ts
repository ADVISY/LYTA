const SESSION_ENFORCER_STORAGE_KEY = "lyta_session_enforcer";

export interface SessionEnforcerState {
  lastActivityAt: number;
  userId: string;
}

export function readSessionEnforcerState(): SessionEnforcerState | null {
  try {
    const rawValue = localStorage.getItem(SESSION_ENFORCER_STORAGE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as Partial<SessionEnforcerState> & { startedAt?: number };
    const lastActivityAt =
      typeof parsed.lastActivityAt === "number"
        ? parsed.lastActivityAt
        : typeof parsed.startedAt === "number"
          ? parsed.startedAt
          : null;

    if (typeof lastActivityAt !== "number" || typeof parsed.userId !== "string") {
      return null;
    }

    return {
      lastActivityAt,
      userId: parsed.userId,
    };
  } catch {
    return null;
  }
}

export function writeSessionEnforcerState(state: SessionEnforcerState) {
  localStorage.setItem(SESSION_ENFORCER_STORAGE_KEY, JSON.stringify(state));
}

export function clearSessionEnforcerState() {
  localStorage.removeItem(SESSION_ENFORCER_STORAGE_KEY);
}
