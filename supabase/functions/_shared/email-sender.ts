const ALLOWED_SENDER_DOMAINS = ["lyta.ch", "e-advisy.ch"];
const DEFAULT_SENDER_EMAIL = "noreply@lyta.ch";
const DEFAULT_SENDER_NAME = "Lyta";

export function getSenderAddress(
  branding: { email_sender_address?: string | null; email_sender_name?: string | null; display_name?: string | null } | null,
  fallbackName?: string
): { fromAddress: string; senderEmail: string; senderName: string } {
  const senderName = branding?.email_sender_name || branding?.display_name || fallbackName || DEFAULT_SENDER_NAME;
  const rawEmail = branding?.email_sender_address || "";

  let senderEmail = DEFAULT_SENDER_EMAIL;
  if (rawEmail && rawEmail.includes("@")) {
    const domain = rawEmail.split("@")[1]?.toLowerCase();
    if (domain && ALLOWED_SENDER_DOMAINS.includes(domain)) {
      senderEmail = rawEmail;
    } else {
      console.warn(`[EMAIL] Blocked sender domain: ${domain}. Using fallback.`);
    }
  }

  return {
    fromAddress: `${senderName} <${senderEmail}>`,
    senderEmail,
    senderName,
  };
}
