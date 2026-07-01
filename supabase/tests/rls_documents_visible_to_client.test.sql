-- ============================================================================
-- Test pgTAP — visible_to_client sur public.documents
-- ============================================================================
-- Valide la policy créée dans la migration 20260626210000. Un client final
-- (portail /espace-client) ne doit voir QUE les documents avec
-- visible_to_client = true. Le broker/admin continue à tout voir, y compris
-- les docs masqués.
-- ============================================================================

BEGIN;

\i _fixtures.sql

SELECT plan(4);

-- Setup : 2 documents pour client_b (tenant_b), 1 visible et 1 masqué
-- Créés en service_role (bypass RLS) pour poser un état déterministe.
SET LOCAL role = service_role;

INSERT INTO public.documents (id, tenant_id, owner_type, owner_id, file_name, file_key, doc_kind, visible_to_client, created_by)
VALUES
  ('d0000001-0001-0001-0001-000000000001', 'bbbb2222-2222-2222-2222-222222222222', 'client', '66666666-b2b2-2222-2222-222222222222', 'facture-visible.pdf', 'client-docs/66666666/facture.pdf', 'facture', true,  '33333333-bbbb-2222-2222-bbbbbbbbbbbb'),
  ('d0000002-0002-0002-0002-000000000002', 'bbbb2222-2222-2222-2222-222222222222', 'client', '66666666-b2b2-2222-2222-222222222222', 'mandat-interne.pdf', 'client-docs/66666666/mandat.pdf', 'mandat', false, '33333333-bbbb-2222-2222-bbbbbbbbbbbb')
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────
-- Test 1 — client_b (user final portail) voit UNIQUEMENT le doc visible
-- ─────────────────────────────────────────────────────────────────────────
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "44444444-bbbb-2222-2222-bbbbbbbbbbbb", "role": "authenticated", "aal": "aal1"}';

SELECT is(
  (SELECT count(*)::int FROM public.documents WHERE owner_id = '66666666-b2b2-2222-2222-222222222222'),
  1,
  'client final voit UNIQUEMENT le doc visible_to_client=true (1/2)'
);

SELECT is(
  (SELECT count(*)::int FROM public.documents WHERE id = 'd0000002-0002-0002-0002-000000000002'),
  0,
  'client final ne voit PAS le doc visible_to_client=false (masqué OK)'
);


-- ─────────────────────────────────────────────────────────────────────────
-- Test 2 — admin_b (broker du même tenant) voit LES DEUX docs
-- ─────────────────────────────────────────────────────────────────────────
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-bbbb-2222-2222-bbbbbbbbbbbb", "role": "authenticated", "aal": "aal1"}';

SELECT is(
  (SELECT count(*)::int FROM public.documents WHERE owner_id = '66666666-b2b2-2222-2222-222222222222'),
  2,
  'admin broker voit LES DEUX docs (visible + masqué)'
);


-- ─────────────────────────────────────────────────────────────────────────
-- Test 3 — admin_a (autre tenant) ne voit AUCUN des 2 docs (isolation)
-- ─────────────────────────────────────────────────────────────────────────
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-aaaa-1111-1111-aaaaaaaaaaaa", "role": "authenticated", "aal": "aal1"}';

SELECT is(
  (SELECT count(*)::int FROM public.documents WHERE owner_id = '66666666-b2b2-2222-2222-222222222222'),
  0,
  'admin cross-tenant ne voit AUCUN des docs du tenant_b (isolation)'
);


SELECT * FROM finish();
ROLLBACK;
