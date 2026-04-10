import { useForcedLogoutAfter } from "@/hooks/useForcedLogoutAfter";

const GLOBAL_SESSION_DURATION_MINUTES = 60;

export function SessionEnforcer() {
  useForcedLogoutAfter(GLOBAL_SESSION_DURATION_MINUTES);
  return null;
}
