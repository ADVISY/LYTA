import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type FamilyMember = {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  relation_type: 'conjoint' | 'enfant' | 'autre';
  permit_type?: string | null;
  nationality?: string | null;
  created_at: string;
  updated_at: string;
  // For bidirectional display
  linked_client_id?: string | null;
  is_reverse_relation?: boolean;
};

export function useFamilyMembers(clientId?: string) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchFamilyMembers = async (id?: string) => {
    try {
      setLoading(true);
      const targetId = id || clientId;
      
      if (!targetId) {
        setFamilyMembers([]);
        return;
      }

      // Get current client info
      const { data: currentClient } = await supabase
        .from('clients')
        .select('first_name, last_name')
        .eq('id', targetId)
        .maybeSingle();

      // 1. Get direct family members (this client is the parent)
      const { data: directMembers, error: directError } = await supabase
        .from('family_members' as any)
        .select('*')
        .eq('client_id', targetId)
        .order('created_at', { ascending: false });

      if (directError) throw directError;

      // 2. Get reverse relationships (this client is a family member of someone else)
      // Find family_members where this client's name matches
      const { data: reverseMembers, error: reverseError } = await supabase
        .from('family_members' as any)
        .select('*, clients!family_members_client_id_fkey(id, first_name, last_name, birthdate, permit_type, nationality)')
        .neq('client_id', targetId);

      if (reverseError) throw reverseError;

      // Filter reverse members to find entries that match this client
      const matchingReverseMembers: FamilyMember[] = [];
      
      if (reverseMembers && currentClient) {
        for (const member of reverseMembers as any[]) {
          // Check if this family member entry matches the current client
          if (
            member.first_name?.toLowerCase() === currentClient.first_name?.toLowerCase() &&
            member.last_name?.toLowerCase() === currentClient.last_name?.toLowerCase()
          ) {
            // Add the parent client as a family member (reverse relationship)
            const parentClient = member.clients;
            if (parentClient) {
              // Determine reverse relation type
              let reverseRelationType: 'conjoint' | 'enfant' | 'autre' = 'autre';
              if (member.relation_type === 'enfant') {
                reverseRelationType = 'autre'; // Child sees parent as "autre" or we could add "parent"
              } else if (member.relation_type === 'conjoint') {
                reverseRelationType = 'conjoint';
              }

              matchingReverseMembers.push({
                id: `reverse-${member.id}`,
                client_id: targetId,
                first_name: parentClient.first_name || '',
                last_name: parentClient.last_name || '',
                birth_date: parentClient.birthdate,
                relation_type: reverseRelationType,
                permit_type: parentClient.permit_type,
                nationality: parentClient.nationality,
                created_at: member.created_at,
                updated_at: member.updated_at,
                linked_client_id: parentClient.id,
                is_reverse_relation: true,
              });

              // Also get siblings (other family members of the same parent)
              const { data: siblings } = await supabase
                .from('family_members' as any)
                .select('*')
                .eq('client_id', parentClient.id)
                .neq('id', member.id);

              if (siblings) {
                for (const sibling of siblings as any[]) {
                  // Don't add ourselves again
                  if (
                    sibling.first_name?.toLowerCase() !== currentClient.first_name?.toLowerCase() ||
                    sibling.last_name?.toLowerCase() !== currentClient.last_name?.toLowerCase()
                  ) {
                    matchingReverseMembers.push({
                      ...sibling,
                      id: `sibling-${sibling.id}`,
                      is_reverse_relation: true,
                    });
                  }
                }
              }
            }
          }
        }
      }

      // Combine direct and reverse members
      const allMembers = [...(directMembers as any[] || []), ...matchingReverseMembers];
      setFamilyMembers(allMembers);
    } catch (error: any) {
      console.error('Error fetching family members:', error);
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createFamilyMember = async (memberData: Omit<FamilyMember, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('family_members' as any)
        .insert([memberData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Membre ajouté",
        description: "Le membre de la famille a été ajouté avec succès"
      });

      await fetchFamilyMembers(memberData.client_id);
      return { data, error: null };
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      return { data: null, error };
    }
  };

  const updateFamilyMember = async (id: string, updates: Partial<FamilyMember>) => {
    try {
      const { error } = await supabase
        .from('family_members' as any)
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Membre mis à jour",
        description: "Les modifications ont été enregistrées"
      });

      await fetchFamilyMembers(clientId);
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const deleteFamilyMember = async (id: string) => {
    try {
      const { error } = await supabase
        .from('family_members' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Membre supprimé",
        description: "Le membre de la famille a été supprimé avec succès"
      });

      await fetchFamilyMembers(clientId);
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchFamilyMembers();
    }
  }, [clientId]);

  return {
    familyMembers,
    loading,
    fetchFamilyMembers,
    createFamilyMember,
    updateFamilyMember,
    deleteFamilyMember
  };
}
