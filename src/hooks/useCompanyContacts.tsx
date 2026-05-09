import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserTenant } from "@/hooks/useUserTenant";

export type ContactType =
  | 'BACK_OFFICE'
  | 'KEY_MANAGER'
  | 'SINISTRES'
  | 'RECLAMATIONS'
  | 'RESILIATION'
  | 'SUPPORT_COURTIER'
  | 'COMMERCIAL'
  | 'GENERAL';

export type ContactChannel = 'EMAIL' | 'TELEPHONE' | 'FORMULAIRE' | 'POSTAL';

export interface CompanyContact {
  id: string;
  /**
   * Owning tenant. Each tenant maintains its own list of company contacts —
   * cabinets often have different account managers / regional broker
   * service inboxes for the same insurer, so a global table would let one
   * tenant overwrite another. RLS enforces this scope on the server.
   */
  tenant_id: string;
  company_id: string;
  contact_type: ContactType;
  channel: ContactChannel;
  value: string;
  label: string | null;
  is_verified: boolean;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  BACK_OFFICE: 'Back-office',
  KEY_MANAGER: 'Key Account Manager',
  SINISTRES: 'Sinistres',
  RECLAMATIONS: 'Réclamations',
  RESILIATION: 'Résiliation',
  SUPPORT_COURTIER: 'Support Courtier',
  COMMERCIAL: 'Commercial',
  GENERAL: 'Contact Général',
};

export const CHANNEL_LABELS: Record<ContactChannel, string> = {
  EMAIL: 'Email',
  TELEPHONE: 'Téléphone',
  FORMULAIRE: 'Formulaire Web',
  POSTAL: 'Adresse Postale',
};

export function useCompanyContacts(companyId?: string) {
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { tenantId } = useUserTenant();

  const fetchContacts = useCallback(async () => {
    if (!companyId || !tenantId) {
      setContacts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // RLS already filters by tenant, but we add the explicit tenant_id
      // filter to be tolerant of the brief window where RLS hasn't been
      // re-applied yet on a freshly migrated environment.
      const { data, error } = await supabase
        .from('company_contacts')
        .select('*')
        .eq('company_id', companyId)
        .eq('tenant_id', tenantId)
        .order('contact_type', { ascending: true })
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setContacts((data || []) as CompanyContact[]);
    } catch (error) {
      console.error('Error fetching company contacts:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les contacts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, tenantId, toast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const addContact = async (
    contact: Omit<CompanyContact, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>,
  ) => {
    if (!tenantId) {
      toast({
        title: "Erreur",
        description: "Aucun cabinet actif — impossible d'ajouter le contact",
        variant: "destructive",
      });
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('company_contacts')
        // tenant_id auto-injected so callers don't have to remember it
        // and RLS WITH CHECK accepts the row.
        .insert({ ...contact, tenant_id: tenantId })
        .select()
        .single();

      if (error) throw error;

      const newContact = data as CompanyContact;
      setContacts(prev => [...prev, newContact]);
      toast({
        title: "Contact ajouté",
        description: "Le contact a été ajouté avec succès",
      });
      return newContact;
    } catch (error) {
      console.error('Error adding contact:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le contact",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateContact = async (id: string, updates: Partial<CompanyContact>) => {
    try {
      const { data, error } = await supabase
        .from('company_contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const updatedContact = data as CompanyContact;
      setContacts(prev => prev.map(c => c.id === id ? updatedContact : c));
      toast({
        title: "Contact mis à jour",
        description: "Les modifications ont été enregistrées",
      });
      return updatedContact;
    } catch (error) {
      console.error('Error updating contact:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le contact",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteContact = async (id: string) => {
    try {
      const { error } = await supabase
        .from('company_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setContacts(prev => prev.filter(c => c.id !== id));
      toast({
        title: "Contact supprimé",
        description: "Le contact a été supprimé",
      });
      return true;
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le contact",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    contacts,
    loading,
    addContact,
    updateContact,
    deleteContact,
    refresh: fetchContacts,
  };
}
