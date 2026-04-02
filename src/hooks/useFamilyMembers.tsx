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
        .from('family_members')
        .select('*')
        .eq('client_id', targetId)
        .order('created_at', { ascending: false });

      if (directError) throw directError;

      // 2. Get reverse relationships (this client is a family member of someone else)
      // Filter server-side by name to avoid loading the entire family_members table (N+1 fix)
      const matchingReverseMembers: FamilyMember[] = [];

      if (currentClient?.first_name && currentClient?.last_name) {
        const { data: reverseMembers, error: reverseError } = await supabase
          .from('family_members')
          .select('*, clients!family_members_client_id_fkey(id, first_name, last_name, birthdate, permit_type, nationality)')
          .neq('client_id', targetId)
          .ilike('first_name', currentClient.first_name)
          .ilike('last_name', currentClient.last_name);

        if (reverseError) throw reverseError;

        type ReverseMemberRow = {
          id: string;
          client_id: string;
          first_name: string;
          last_name: string;
          relation_type: 'conjoint' | 'enfant' | 'autre';
          created_at: string;
          updated_at: string;
          clients: {
            id: string;
            first_name: string | null;
            last_name: string | null;
            birthdate: string | null;
            permit_type: string | null;
            nationality: string | null;
          } | null;
        };

        const parentIds: string[] = [];
        const memberIdsToExclude: string[] = [];

        if (reverseMembers) {
          for (const member of reverseMembers as ReverseMemberRow[]) {
            const parentClient = member.clients;
            if (parentClient) {
              let reverseRelationType: 'conjoint' | 'enfant' | 'autre' = 'autre';
              if (member.relation_type === 'conjoint') {
                reverseRelationType = 'conjoint';
              }

              parentIds.push(parentClient.id);
              memberIdsToExclude.push(member.id);

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
            }
          }
        }

        // Fetch siblings in a single batch query (only if we found reverse relations)
        if (parentIds.length > 0) {
          const { data: allSiblings } = await supabase
            .from('family_members')
            .select('*')
            .in('client_id', parentIds)
            .not('id', 'in', `(${memberIdsToExclude.join(',')})`);

          if (allSiblings) {
            for (const sibling of allSiblings) {
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

      // Combine direct and reverse members
      const allMembers = [...(directMembers ?? []), ...matchingReverseMembers];
      setFamilyMembers(allMembers);
    } catch (error: unknown) {
      console.error('Error fetching family members:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createFamilyMember = async (memberData: Omit<FamilyMember, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('family_members')
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
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive"
      });
      return { data: null, error };
    }
  };

  const updateFamilyMember = async (id: string, updates: Partial<FamilyMember>) => {
    try {
      const { error } = await supabase
        .from('family_members')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Membre mis à jour",
        description: "Les modifications ont été enregistrées"
      });

      await fetchFamilyMembers(clientId);
      return { error: null };
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive"
      });
      return { error };
    }
  };

  const deleteFamilyMember = async (id: string) => {
    try {
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Membre supprimé",
        description: "Le membre de la famille a été supprimé avec succès"
      });

      await fetchFamilyMembers(clientId);
      return { error: null };
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : String(error),
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
