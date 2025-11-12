import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// TODO API: Ces hooks remplacent les données mock et interagissent avec Supabase

// Hook pour récupérer les données du partner connecté
export function usePartnerProfile() {
  return useQuery({
    queryKey: ['partner-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await supabase
        .from('partners')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email,
            phone
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

// Hook pour récupérer les policies d'un partner
export function usePartnerPolicies(filters?: {
  status?: string;
  companyId?: string;
  productId?: string;
}) {
  const { data: partner } = usePartnerProfile();

  return useQuery({
    queryKey: ['partner-policies', partner?.id, filters],
    queryFn: async () => {
      if (!partner?.id) return [];

      let query = supabase
        .from('policies')
        .select(`
          *,
          client:clients!inner (
            id,
            company_name,
            is_company,
            profiles:user_id (full_name)
          ),
          product:insurance_products!inner (
            id,
            name,
            category,
            company:insurance_companies!inner (
              id,
              name
            )
          ),
          contracts (
            id,
            signature_status,
            signed_at,
            renewal_date
          )
        `)
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.productId) {
        query = query.eq('product_id', filters.productId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!partner?.id,
  });
}

// Hook pour récupérer les commissions d'un partner
export function usePartnerCommissions(filters?: {
  status?: string;
  productId?: string;
  from?: string;
  to?: string;
}) {
  const { data: partner } = usePartnerProfile();

  return useQuery({
    queryKey: ['partner-commissions', partner?.id, filters],
    queryFn: async () => {
      if (!partner?.id) return [];

      let query = supabase
        .from('commissions')
        .select(`
          *,
          policy:policies!inner (
            id,
            policy_number,
            product:insurance_products!inner (
              name,
              category,
              company:insurance_companies!inner (name)
            )
          )
        `)
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.from) {
        query = query.gte('created_at', filters.from);
      }
      if (filters?.to) {
        query = query.lte('created_at', filters.to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!partner?.id,
  });
}

// Hook pour récupérer les documents
export function useDocuments(ownerId?: string, ownerType?: string) {
  return useQuery({
    queryKey: ['documents', ownerId, ownerType],
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (ownerId && ownerType) {
        query = query
          .eq('owner_id', ownerId)
          .eq('owner_type', ownerType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Mutation pour créer une policy
export function useCreatePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (policyData: {
      client_id: string;
      product_id: string;
      partner_id: string;
      start_date: string;
      end_date?: string;
      premium_monthly?: number;
      premium_yearly?: number;
      deductible?: number;
      policy_number?: string;
    }) => {
      const { data, error } = await supabase
        .from('policies')
        .insert(policyData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-policies'] });
      toast.success("Police créée avec succès");
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Mutation pour mettre à jour une commission (marquer comme payée)
export function useUpdateCommission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      paid_at 
    }: { 
      id: string; 
      status: string; 
      paid_at?: string;
    }) => {
      const { data, error } = await supabase
        .from('commissions')
        .update({ status, paid_at })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-commissions'] });
      toast.success("Commission mise à jour");
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Hook pour récupérer les compagnies d'assurance
export function useInsuranceCompanies() {
  return useQuery({
    queryKey: ['insurance-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_companies')
        .select('*')
        .order('name');

      if (error) throw error;
      return data;
    },
  });
}

// Hook pour récupérer les produits d'assurance
export function useInsuranceProducts(companyId?: string) {
  return useQuery({
    queryKey: ['insurance-products', companyId],
    queryFn: async () => {
      let query = supabase
        .from('insurance_products')
        .select(`
          *,
          company:insurance_companies (
            id,
            name
          )
        `)
        .order('name');

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Hook pour récupérer les clients
export function useClients(partnerId?: string) {
  return useQuery({
    queryKey: ['clients', partnerId],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Mutation pour créer un client
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientData: {
      company_name?: string;
      is_company: boolean;
      phone?: string;
      address?: string;
      city?: string;
      postal_code?: string;
      birthdate?: string;
    }) => {
      const { data, error } = await supabase
        .from('clients')
        .insert(clientData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success("Client créé avec succès");
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Hook pour les notifications
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });
}

// Mutation pour marquer une notification comme lue
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
