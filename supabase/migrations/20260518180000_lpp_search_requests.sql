-- ============================================================================
-- LPP Search Requests — tracking des recherches LPP envoyées aux 2 institutions
-- ============================================================================
-- Quand le cabinet clique "Envoyer recherche LPP" sur un contrat LPP, on envoie
-- 2 emails (Centrale du 2e pilier + Fondation Institution Supplétive) avec
-- pièce d'identité + procuration en pièces jointes, et on track ici.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lpp_search_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,

  -- Snapshot des données envoyées (au cas où le client/contrat est modifié plus tard)
  client_full_name TEXT NOT NULL,
  client_birthdate DATE,
  client_avs_number TEXT,
  documents_attached JSONB DEFAULT '[]'::jsonb,  -- liste des file_keys

  -- Statut par institution
  -- 'pending' | 'sent' | 'response_received' | 'failed'
  centrale_status TEXT NOT NULL DEFAULT 'pending',
  centrale_sent_at TIMESTAMPTZ,
  centrale_email_log_id UUID,  -- FK vers tenant_email_log si dispo
  centrale_response_at TIMESTAMPTZ,
  centrale_response_notes TEXT,

  suppletive_status TEXT NOT NULL DEFAULT 'pending',
  suppletive_sent_at TIMESTAMPTZ,
  suppletive_email_log_id UUID,
  suppletive_response_at TIMESTAMPTZ,
  suppletive_response_notes TEXT,

  -- Overall
  overall_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'completed' | 'failed'
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lpp_search_tenant ON public.lpp_search_requests (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lpp_search_policy ON public.lpp_search_requests (policy_id);
CREATE INDEX IF NOT EXISTS idx_lpp_search_client ON public.lpp_search_requests (client_id);

-- RLS : un tenant ne voit que ses propres recherches
ALTER TABLE public.lpp_search_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can see their LPP search requests"
  ON public.lpp_search_requests FOR SELECT TO authenticated
  USING (
    public.is_king() OR EXISTS (
      SELECT 1 FROM public.user_tenant_assignments uta
       WHERE uta.user_id = auth.uid() AND uta.tenant_id = lpp_search_requests.tenant_id
    )
  );

CREATE POLICY "Tenant staff can create LPP search requests"
  ON public.lpp_search_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_king() OR EXISTS (
      SELECT 1 FROM public.user_tenant_assignments uta
       WHERE uta.user_id = auth.uid() AND uta.tenant_id = lpp_search_requests.tenant_id
    )
  );

CREATE POLICY "Tenant staff can update their LPP search requests"
  ON public.lpp_search_requests FOR UPDATE TO authenticated
  USING (
    public.is_king() OR EXISTS (
      SELECT 1 FROM public.user_tenant_assignments uta
       WHERE uta.user_id = auth.uid() AND uta.tenant_id = lpp_search_requests.tenant_id
    )
  );

COMMENT ON TABLE public.lpp_search_requests IS
  'Recherches LPP envoyées aux 2 institutions officielles (Centrale 2P + Suppletive). Tracking du statut par institution + réponse reçue.';
