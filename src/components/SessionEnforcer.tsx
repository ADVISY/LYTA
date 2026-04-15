import { useForcedLogoutAfter } from "@/hooks/useForcedLogoutAfter";
import { useLocation } from "react-router-dom";

const GLOBAL_SESSION_DURATION_MINUTES = 60;
const PUBLIC_AUTH_PATHS = new Set(["/connexion", "/reset-password"]);

export function SessionEnforcer() {
  const { pathname } = useLocation();
  const shouldEnforce = !PUBLIC_AUTH_PATHS.has(pathname);

  useForcedLogoutAfter(shouldEnforce ? GLOBAL_SESSION_DURATION_MINUTES : null);
  return null;
}
