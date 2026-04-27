import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";
import { invokeSupabaseFunction } from "@/lib/edgeFunctions";
import { buildTenantLoginUrl } from "@/lib/tenantUrls";

type EmailType = "welcome" | "partner_welcome" | "contract_signed" | "mandat_signed" | "account_created" | "relation_client" | "offre_speciale";

interface EmailData {
  subject?: string;
  html?: string;
  contractDetails?: string;
  companyName?: string;
  agentName?: string;
  temporaryPassword?: string;
  loginUrl?: string;
  clientEmail?: string;
  tenantId?: string;
  tenantSlug?: string;
}

interface SendEmailParams {
  type: EmailType;
  clientEmail: string;
  clientName: string;
  data?: EmailData;
}

export const useCrmEmails = () => {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { tenantId } = useUserTenant();

  const sendEmail = async ({ type, clientEmail, clientName, data }: SendEmailParams) => {
    try {
      console.log(`Sending ${type} email to ${clientEmail}`);
      const loginUrl = buildTenantLoginUrl(tenant?.slug, "client");

      const response = await invokeSupabaseFunction("send-crm-email", {
        body: {
          type,
          clientEmail: clientEmail.trim(),
          clientName,
          tenantSlug: tenant?.slug,
          tenantId,
          data: {
            ...(data ?? {}),
            tenantSlug: data?.tenantSlug ?? tenant?.slug,
            tenantId: data?.tenantId ?? tenantId ?? undefined,
            loginUrl: data?.loginUrl ?? loginUrl,
          },
        },
      });

      console.log("Email sent successfully:", response);

      const messages: Record<EmailType, string> = {
        welcome: "Email de bienvenue envoyé",
        partner_welcome: "Email de bienvenue partenaire envoyé",
        contract_signed: "Confirmation de signature envoyée",
        mandat_signed: "Email avec identifiants envoyé",
        account_created: "Identifiants de connexion envoyés",
        relation_client: "Email relation client envoyé",
        offre_speciale: "Email d'offre spéciale envoyé",
      };

      toast({
        title: "Email envoyé",
        description: messages[type],
      });

      return { success: true, data: response };
    } catch (error) {
      console.error("Email send exception:", error);
      const message = error instanceof Error && error.message
        ? error.message
        : "Une erreur est survenue lors de l'envoi de l'email";

      toast({
        title: "Erreur d'envoi",
        description: message,
        variant: "destructive",
      });

      return { success: false, error };
    }
  };

  const sendWelcomeEmail = async (clientEmail: string, clientName: string) => {
    return sendEmail({ type: "welcome", clientEmail, clientName });
  };

  const sendPartnerWelcomeEmail = async (clientEmail: string, clientName: string) => {
    return sendEmail({ type: "partner_welcome", clientEmail, clientName });
  };

  const sendContractSignedEmail = async (
    clientEmail: string,
    clientName: string,
    contractDetails?: string,
    companyName?: string,
    agentName?: string,
  ) => {
    return sendEmail({
      type: "contract_signed",
      clientEmail,
      clientName,
      data: { contractDetails, companyName, agentName },
    });
  };

  const sendMandatSignedEmail = async (clientEmail: string, clientName: string) => {
    return sendEmail({
      type: "mandat_signed",
      clientEmail,
      clientName,
    });
  };

  const sendAccountCreatedEmail = async (
    clientEmail: string,
    clientName: string,
    temporaryPassword: string,
  ) => {
    return sendEmail({
      type: "account_created",
      clientEmail,
      clientName,
      data: {
        temporaryPassword,
        clientEmail,
        loginUrl: buildTenantLoginUrl(tenant?.slug, "client"),
      },
    });
  };

  return {
    sendEmail,
    sendWelcomeEmail,
    sendPartnerWelcomeEmail,
    sendContractSignedEmail,
    sendMandatSignedEmail,
    sendAccountCreatedEmail,
  };
};
