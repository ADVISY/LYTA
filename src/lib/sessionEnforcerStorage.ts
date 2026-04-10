const SESSION_ENFORCER_STORAGE_KEY = "lyta_session_enforcer";

export interface SessionEnforcerState {
  startedAt: number;
  userId: string;
}

export function readSessionEnforcerState(): SessionEnforcerState | null {
  try {
    const rawValue = localStorage.getItem(SESSION_ENFORCER_STORAGE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as Partial<SessionEnforcerState>;
    if (typeof parsed.startedAt !== "number" || typeof parsed.userId !== "string") {
      return null;
    }

    return {
      startedAt: parsed.startedAt,
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
