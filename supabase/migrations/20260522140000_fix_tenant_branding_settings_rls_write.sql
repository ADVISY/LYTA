-- ============================================================================
-- Fix : policies RLS manquantes pour permettre aux Admins Cabinet
-- de modifier tenant_branding et tenant_security_settings
-- ============================================================================
-- BUG observé : depuis CRMParametres → onglet Cabinet, les infos modifiées
-- (display_name, IBAN, email cabinet, etc.) ne se sauvegardaient pas.
-- Cause : seules les policies "Kings can manage all branding" (FOR ALL)
-- et "Tenant users can view their branding" (FOR SELECT) existaient.
-- Aucune policy INSERT/UPDATE/DELETE pour les Admins Cabinet non-Kings.
-- Résultat : .upsert() rejeté silencieusement par RLS.
--
-- Fix : on autorise les Admins Cabinet ET les Managers à écrire sur le
-- branding/settings de LEUR PROPRE tenant. is_tenant_admin() vérifie déjà
-- qu'on a un rôle 'Admin Cabinet' ou 'Manager' dans user_tenant_roles.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- tenant_branding : INSERT / UPDATE / DELETE pour Admins du tenant
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant admins can insert their branding" ON public.tenant_branding;
CREATE POLICY "Tenant admins can insert their branding"
ON public.tenant_branding
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_tenant_admin()
  AND tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Tenant admins can update their branding" ON public.tenant_branding;
CREATE POLICY "Tenant admins can update their branding"
ON public.tenant_branding
FOR UPDATE
TO authenticated
USING (
  public.is_tenant_admin()
  AND tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_tenant_admin()
  AND tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Tenant admins can delete their branding" ON public.tenant_branding;
CREATE POLICY "Tenant admins can delete their branding"
ON public.tenant_branding
FOR DELETE
TO authenticated
USING (
  public.is_tenant_admin()
  AND tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- tenant_security_settings : INSERT / UPDATE pour Admins du tenant
-- (DELETE volontairement réservé aux Kings — sécurité plateforme)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant admins can insert their security settings" ON public.tenant_security_settings;
CREATE POLICY "Tenant admins can insert their security settings"
ON public.tenant_security_settings
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_tenant_admin()
  AND tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Tenant admins can update their security settings" ON public.tenant_security_settings;
CREATE POLICY "Tenant admins can update their security settings"
ON public.tenant_security_settings
FOR UPDATE
TO authenticated
USING (
  public.is_tenant_admin()
  AND tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_tenant_admin()
  AND tenant_id IN (
    SELECT tenant_id FROM public.user_tenant_assignments WHERE user_id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- King notification : trou de policy corrigé
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'RLS tenant_branding/settings — INSERT/UPDATE ouverts aux Admins Cabinet',
  'Les modifs des infos cabinet (nom, IBAN, email, sécurité) sauvegardent maintenant correctement pour tous les tenants admins, pas seulement les Kings.',
  'system_info', 'low',
  jsonb_build_object(
    'migration', '20260522140000_fix_tenant_branding_settings_rls_write',
    'tables', ARRAY['tenant_branding', 'tenant_security_settings']
  )
);
