type LoginSpace = "client" | "team" | "king";

function isLocalOrPreviewHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.includes("lovable.app") ||
    hostname.includes("lovableproject.com") ||
    hostname.includes("vercel.app") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  );
}

export function buildTenantLoginUrl(
  tenantSlug: string | null | undefined,
  space: LoginSpace = "client",
): string {
  const localUrl = new URL("/connexion", window.location.origin);
  localUrl.searchParams.set("space", space);

  if (!tenantSlug) {
    return localUrl.toString();
  }

  if (isLocalOrPreviewHost(window.location.hostname)) {
    localUrl.searchParams.set("tenant", tenantSlug);
    return localUrl.toString();
  }

  return `${window.location.protocol}//${tenantSlug}.lyta.ch/connexion?space=${encodeURIComponent(space)}`;
}
