import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

type NotificationKind = 'contract' | 'document' | 'invoice' | 'claim' | 'message';

interface NotifyClientParams {
  clientId: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  payload?: Json;
}

/**
 * Envoie une notification à un client dans son espace client
 * Simple: insère dans la table notifications avec le user_id du client
 */
export async function notifyClient({ clientId, kind, title, message, payload }: NotifyClientParams): Promise<boolean> {
  try {
    // 1. Récupérer le user_id du client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client?.user_id) {
      console.log('Client has no user account, skipping notification');
      return false;
    }

    // 2. Insérer la notification
    const { error: notifError } = await supabase
      .from('notifications')
      .insert([{
        user_id: client.user_id,
        kind,
        title,
        message: message || null,
        payload: payload || null
      }]);

    if (notifError) {
      console.error('Error creating notification:', notifError);
      return false;
    }

    console.log(`Notification sent to client ${clientId}: ${kind} - ${title}`);
    return true;
  } catch (error) {
    console.error('Error in notifyClient:', error);
    return false;
  }
}

/**
 * Notifications prédéfinies pour les actions CRM courantes
 */
export const ClientNotifications = {
  newContract: (clientId: string, policyId: string, productName?: string) => 
    notifyClient({
      clientId,
      kind: 'contract',
      title: 'Nouveau contrat ajouté',
      message: productName ? `Votre contrat ${productName} a été enregistré.` : 'Un nouveau contrat a été ajouté à votre dossier.',
      payload: { policy_id: policyId }
    }),

  newDocument: (clientId: string, documentName: string, docKind?: string) =>
    notifyClient({
      clientId,
      kind: 'document',
      title: 'Nouveau document disponible',
      message: `Le document "${documentName}" est maintenant accessible.`,
      payload: { doc_kind: docKind }
    }),

  newInvoice: (clientId: string, invoiceNumber: string, amount: number) =>
    notifyClient({
      clientId,
      kind: 'invoice',
      title: 'Nouvelle facture',
      message: `Facture ${invoiceNumber} de CHF ${amount.toFixed(2)}`,
      payload: { invoice_number: invoiceNumber, amount }
    }),

  claimStatusUpdate: (clientId: string, claimId: string, newStatus: string) =>
    notifyClient({
      clientId,
      kind: 'claim',
      title: 'Mise à jour de votre sinistre',
      message: `Le statut de votre sinistre a été mis à jour: ${newStatus}`,
      payload: { claim_id: claimId, status: newStatus }
    }),

  newMessage: (clientId: string) =>
    notifyClient({
      clientId,
      kind: 'message',
      title: 'Nouveau message',
      message: 'Vous avez reçu un nouveau message de votre conseiller.',
      payload: {}
    })
};
