import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserTenant } from '@/hooks/useUserTenant';
import { recordAuditLog } from '@/lib/audit';

export type FamilyMember = {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  relation_type: 'conjoint' | 'enfant' | 'parent' | 'autre';
  permit_type?: string | null;
  nationality?: string | null;
  created_at: string;
  updated_at: string;
  linked_client_id?: string | null;
  is_reverse_relation?: boolean;
};

export function useFamilyMembers(clientId?: string) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { tenantId } = useUserTenant();

  const fetchFamilyMembers = async (id?: string) => {
    try {
      setLoading(true);
      const targetId = id || clientId;

      if (!targetId) {
        setFamilyMembers([]);
        return;
      }

      const { data: currentClient } = await supabase
        .from('clients')
        .select('first_name, last_name')
        .eq('id', targetId)
        .maybeSingle();

      const { data: directMembers, error: directError } = await supabase
        .from('family_members')
        .select(`
          *,
          linked_client:clients!family_members_linked_client_id_fkey(
            id,
            first_name,
            last_name,
            birthdate,
            permit_type,
            nationality
          )
        `)
        .eq('client_id', targetId)
        .order('created_at', { ascending: false });

      if (directError) throw directError;

      const mappedDirectMembers: FamilyMember[] = (directMembers || []).map((member: any) => ({
        id: member.id,
        client_id: member.client_id,
        first_name: member.first_name,
        last_name: member.last_name,
        birth_date: member.birth_date,
        relation_type: member.relation_type,
        permit_type: member.permit_type ?? member.linked_client?.permit_type ?? null,
        nationality: member.nationality ?? member.linked_client?.nationality ?? null,
        created_at: member.created_at,
        updated_at: member.updated_at,
        linked_client_id: member.linked_client_id ?? member.linked_client?.id ?? null,
      }));

      const reverseMembers: FamilyMember[] = [];

      const inverseRelation = (
        relation: FamilyMember["relation_type"]
      ): FamilyMember["relation_type"] => {
        if (relation === "conjoint") return "conjoint";
        if (relation === "enfant") return "parent";
        if (relation === "parent") return "enfant";
        return "autre";
      };

      const { data: reverseRows, error: reverseRowsError } = await supabase
        .from('family_members')
        .select(`
          *,
          parent_client:clients!family_members_client_id_fkey(
            id,
            first_name,
            last_name,
            birthdate,
            permit_type,
            nationality
          )
        `)
        .eq('linked_client_id', targetId)
        .neq('client_id', targetId);

      if (reverseRowsError) throw reverseRowsError;

      const parentIds = new Set<string>();

      for (const member of reverseRows || []) {
        const parentClient = (member as any).parent_client;
        if (!parentClient) continue;

        parentIds.add(parentClient.id);
        reverseMembers.push({
          id: `reverse-${member.id}`,
          client_id: targetId,
          first_name: parentClient.first_name || '',
          last_name: parentClient.last_name || '',
          birth_date: parentClient.birthdate,
          relation_type: inverseRelation(member.relation_type),
          permit_type: parentClient.permit_type,
          nationality: parentClient.nationality,
          created_at: member.created_at,
          updated_at: member.updated_at,
          linked_client_id: parentClient.id,
          is_reverse_relation: true,
        });
      }

      if (currentClient?.first_name && currentClient?.last_name) {
        const { data: legacyReverseMembers, error: reverseError } = await supabase
          .from('family_members')
          .select('*, clients!family_members_client_id_fkey(id, first_name, last_name, birthdate, permit_type, nationality)')
          .neq('client_id', targetId)
          .is('linked_client_id', null)
          .ilike('first_name', currentClient.first_name)
          .ilike('last_name', currentClient.last_name);

        if (reverseError) throw reverseError;

        type ReverseMemberRow = {
          id: string;
          client_id: string;
          first_name: string;
          last_name: string;
          relation_type: 'conjoint' | 'enfant' | 'parent' | 'autre';
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

        const memberIdsToExclude: string[] = [];

        if (legacyReverseMembers) {
          for (const member of legacyReverseMembers as ReverseMemberRow[]) {
            const parentClient = member.clients;
            if (parentClient) {
              parentIds.add(parentClient.id);
              memberIdsToExclude.push(member.id);

              reverseMembers.push({
                id: `reverse-${member.id}`,
                client_id: targetId,
                first_name: parentClient.first_name || '',
                last_name: parentClient.last_name || '',
                birth_date: parentClient.birthdate,
                relation_type: inverseRelation(member.relation_type),
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

        if (parentIds.size > 0) {
          const { data: allSiblings } = await supabase
            .from('family_members')
            .select(`
              *,
              linked_client:clients!family_members_linked_client_id_fkey(
                id,
                first_name,
                last_name,
                birthdate,
                permit_type,
                nationality
              )
            `)
            .in('client_id', Array.from(parentIds))
            .neq('linked_client_id', targetId);

          if (allSiblings) {
            for (const sibling of allSiblings) {
              if (memberIdsToExclude.includes(sibling.id)) continue;
              if (!sibling.linked_client_id || sibling.linked_client_id === targetId) continue;

              reverseMembers.push({
                id: `sibling-${sibling.id}`,
                client_id: sibling.client_id,
                first_name: sibling.first_name,
                last_name: sibling.last_name,
                birth_date: sibling.birth_date,
                relation_type: sibling.relation_type,
                permit_type: sibling.permit_type ?? sibling.linked_client?.permit_type ?? null,
                nationality: sibling.nationality ?? sibling.linked_client?.nationality ?? null,
                created_at: sibling.created_at,
                updated_at: sibling.updated_at,
                linked_client_id: sibling.linked_client_id,
                is_reverse_relation: true,
              });
            }
          }
        }
      }

      // Dédup en 2 passes :
      //   1. Par `id` (cas trivial, ceinture)
      //   2. Par `linked_client_id` (rescue : avant juin 2026, FamilyMemberForm
      //      insérait DEUX rows (direct + reverse) pour chaque nouveau membre,
      //      → sur la fiche parent on voyait l'enfant 2x. Le fix Form évite
      //      ça pour les NOUVEAUX, mais on a des dupes en base sur les
      //      tenants existants. Cette 2e passe les cache (on ne supprime pas
      //      la donnée — juste l'affichage). On garde la PREMIÈRE occurrence
      //      qui sera le row direct (= ordre des push : mappedDirectMembers
      //      d'abord, puis reverseMembers).
      const allMembers = [...mappedDirectMembers, ...reverseMembers]
        .filter((member, index, array) => array.findIndex((c) => c.id === member.id) === index)
        .filter((member, index, array) => {
          if (!member.linked_client_id) return true; // pas de linked → pas de risque dup
          return array.findIndex((c) => c.linked_client_id === member.linked_client_id) === index;
        });
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

      await recordAuditLog({
        action: 'create',
        entity: 'family_member',
        entityId: data.id,
        tenantId,
        metadata: {
          client_id: data.client_id,
          linked_client_id: data.linked_client_id,
          relation_type: data.relation_type,
        },
      });

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

      await recordAuditLog({
        action: 'update',
        entity: 'family_member',
        entityId: id,
        tenantId,
        metadata: {
          changes: updates,
        },
      });

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
      const existingMember = familyMembers.find((member) => member.id === id);

      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await recordAuditLog({
        action: 'delete',
        entity: 'family_member',
        entityId: id,
        tenantId,
        metadata: {
          client_id: existingMember?.client_id ?? null,
          linked_client_id: existingMember?.linked_client_id ?? null,
          relation_type: existingMember?.relation_type ?? null,
        },
      });

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
