import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

  const fetchContacts = useCallback(async () => {
    if (!companyId) {
      setContacts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('contact_type, is_primary desc, created_at');

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
  }, [companyId, toast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const addContact = async (contact: Omit<CompanyContact, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('company_contacts')
        .insert(contact)
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
