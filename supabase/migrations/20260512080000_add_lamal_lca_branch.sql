-- ============================================================================
-- Add a 13th system branch: Santé LAMal + LCA (combined health policy)
-- ============================================================================
-- Some Swiss health contracts cover BOTH the mandatory LAMal base AND
-- a complementary LCA package in a single contract. Until now, the
-- broker had to pick one or the other. This adds an explicit combined
-- branch so those policies are categorised correctly.
--
-- Idempotent — safe to run repeatedly.
-- ============================================================================

-- 1. Update the seed function so future tenants also get this branch
CREATE OR REPLACE FUNCTION public.seed_tenant_branches(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_branches (tenant_id, code, name, description, icon, color, is_system, sort_order)
  VALUES
    (p_tenant_id, 'LAMAL',        'LAMal',                   'Assurance maladie obligatoire (KVG)',                          'Heart',       '#10b981', true, 10),
    (p_tenant_id, 'LAMAL_LCA',    'Santé LAMal + LCA',       'Contrat santé combiné — base LAMal + complémentaire LCA',       'Heart',       '#0ea5e9', true, 15),
    (p_tenant_id, 'LCA',          'LCA santé',               'Assurance maladie complémentaire (VVG) — hospi, ambu, dentaire', 'HeartPulse', '#06b6d4', true, 20),
    (p_tenant_id, 'PGM',          'Indemnités journalières', 'Perte de gain maladie / accident',                              'Activity',    '#f59e0b', true, 30),
    (p_tenant_id, 'ACCIDENT',     'Accident (LAA + compl.)', 'LAA obligatoire + complémentaires accident',                    'ShieldAlert', '#ef4444', true, 40),
    (p_tenant_id, 'VIE',          'Vie & Prévoyance',        'Vie individuelle, 3e pilier A/B, risque, mixte, rente',         'Sparkles',    '#8b5cf6', true, 50),
    (p_tenant_id, 'LPP',          'LPP (2e pilier)',         'Prévoyance professionnelle',                                    'Briefcase',   '#6366f1', true, 60),
    (p_tenant_id, 'AUTO',         'Véhicules',               'Auto, moto, bateau, camping-car (RC + Casco)',                  'Car',         '#3b82f6', true, 70),
    (p_tenant_id, 'MENAGE_RC',    'Ménage & RC privée',      'RC privée, ménage, bâtiment, animaux',                          'Home',        '#ec4899', true, 80),
    (p_tenant_id, 'JURIDIQUE',    'Protection juridique',    'Privée, circulation, entreprise',                               'Scale',       '#64748b', true, 90),
    (p_tenant_id, 'VOYAGE',       'Voyage & Assistance',     'Annulation, assistance, long séjour',                           'Plane',       '#0ea5e9', true, 100),
    (p_tenant_id, 'ENTREPRISE',   'Entreprise PME',          'RC pro, choses, pertes expl., D&O, cyber, construction, transport', 'Building2', '#475569', true, 110),
    (p_tenant_id, 'HYPO_CREDIT',  'Hypothèque & Crédit',     'Hypothèque, crédit personnel, leasing',                         'Landmark',    '#f97316', true, 120)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;

-- 2. Backfill the new LAMAL_LCA branch for all existing tenants
DO $$
DECLARE
  v_tenant RECORD;
BEGIN
  FOR v_tenant IN SELECT id FROM public.tenants LOOP
    INSERT INTO public.tenant_branches (tenant_id, code, name, description, icon, color, is_system, sort_order)
    VALUES (v_tenant.id, 'LAMAL_LCA', 'Santé LAMal + LCA', 'Contrat santé combiné — base LAMal + complémentaire LCA', 'Heart', '#0ea5e9', true, 15)
    ON CONFLICT (tenant_id, code) DO NOTHING;
  END LOOP;
END;
$$;
