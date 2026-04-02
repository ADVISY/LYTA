import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type EmailType = "welcome" | "contract_signed" | "mandat_signed" | "account_created" | "relation_client" | "offre_speciale";

interface EmailData {
  contractDetails?: string;
  companyName?: string;
  agentName?: string;
  temporaryPassword?: string;
  loginUrl?: string;
  clientEmail?: string;
}

interface SendEmailParams {
  type: EmailType;
  clientEmail: string;
  clientName: string;
  data?: EmailData;
}

export const useCrmEmails = () => {
  const { toast } = useToast();

  const sendEmail = async ({ type, clientEmail, clientName, data }: SendEmailParams) => {
    try {
      console.log(`Sending ${type} email to ${clientEmail}`);

      const { data: response, error } = await supabase.functions.invoke('send-crm-email', {
        body: { type, clientEmail, clientName, data },
      });

      if (error) {
        console.error('Email send error:', error);
        toast({
          title: "Erreur d'envoi",
          description: `L'email n'a pas pu être envoyé: ${error.message}`,
          variant: "destructive",
        });
        return { success: false, error };
      }

      console.log('Email sent successfully:', response);
      
      // Show success toast based on email type
      const messages: Record<EmailType, string> = {
        welcome: "Email de bienvenue envoyé",
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
      console.error('Email send exception:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'envoi de l'email",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  // Convenience methods for each email type
  const sendWelcomeEmail = async (clientEmail: string, clientName: string) => {
    return sendEmail({ type: "welcome", clientEmail, clientName });
  };

  const sendContractSignedEmail = async (
    clientEmail: string, 
    clientName: string, 
    contractDetails?: string,
    companyName?: string,
    agentName?: string
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
    temporaryPassword: string
  ) => {
    return sendEmail({
      type: "account_created",
      clientEmail,
      clientName,
      data: { 
        temporaryPassword, 
        clientEmail,
        loginUrl: `${window.location.origin}/connexion` 
      },
    });
  };

  return {
    sendEmail,
    sendWelcomeEmail,
    sendContractSignedEmail,
    sendMandatSignedEmail,
    sendAccountCreatedEmail,
  };
};
