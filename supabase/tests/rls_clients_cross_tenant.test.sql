-- ============================================================================
-- Test pgTAP — isolation cross-tenant sur public.clients
-- ============================================================================
-- Vérifie que la policy SELECT clients + les branches scope respectent la
-- séparation stricte des cabinets. Un admin/agent du tenant A ne doit
-- JAMAIS voir un client du tenant B, et vice-versa.
-- ============================================================================

BEGIN;

-- Setup fixtures (2 tenants, users, clients)
\i _fixtures.sql

SELECT plan(6);

-- ─────────────────────────────────────────────────────────────────────────
-- Test 1 — admin_a voit son client mais pas celui de tenant_b
-- ─────────────────────────────────────────────────────────────────────────
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-aaaa-1111-1111-aaaaaaaaaaaa", "role": "authenticated", "aal": "aal1"}';

SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE id = '55555555-a1a1-1111-1111-111111111111'),
  1,
  'admin_a voit son propre client (tenant_a)'
);

SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE id = '66666666-b2b2-2222-2222-222222222222'),
  0,
  'admin_a ne voit PAS le client du tenant_b (cross-tenant leak bloqué)'
);


-- ─────────────────────────────────────────────────────────────────────────
-- Test 2 — admin_b symétriquement isolé
-- ─────────────────────────────────────────────────────────────────────────
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-bbbb-2222-2222-bbbbbbbbbbbb", "role": "authenticated", "aal": "aal1"}';

SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE id = '66666666-b2b2-2222-2222-222222222222'),
  1,
  'admin_b voit son propre client (tenant_b)'
);

SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE id = '55555555-a1a1-1111-1111-111111111111'),
  0,
  'admin_b ne voit PAS le client du tenant_a (cross-tenant leak bloqué)'
);


-- ─────────────────────────────────────────────────────────────────────────
-- Test 3 — INSERT cross-tenant bloqué
-- Un admin_a ne peut pas créer un client dans tenant_b.
-- La policy INSERT devrait raise (ou l'INSERT return 0 rows).
-- ─────────────────────────────────────────────────────────────────────────
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-aaaa-1111-1111-aaaaaaaaaaaa", "role": "authenticated", "aal": "aal1"}';

SELECT throws_ok(
  $$
    INSERT INTO public.clients (id, tenant_id, first_name, last_name, type_adresse, status)
    VALUES ('77777777-cccc-3333-3333-333333333333', 'bbbb2222-2222-2222-2222-222222222222', 'Fake', 'Cross', 'client', 'client')
  $$,
  '42501', -- ERRCODE insufficient_privilege
  NULL, -- pas de message spécifique attendu (varie selon policy)
  'admin_a ne peut PAS créer un client dans tenant_b (INSERT bloqué RLS)'
);


-- ─────────────────────────────────────────────────────────────────────────
-- Test 4 — UPDATE cross-tenant bloqué
-- ─────────────────────────────────────────────────────────────────────────
SELECT is(
  (
    WITH try_update AS (
      UPDATE public.clients
      SET first_name = 'HACKED'
      WHERE id = '66666666-b2b2-2222-2222-222222222222'
      RETURNING id
    )
    SELECT count(*)::int FROM try_update
  ),
  0,
  'admin_a ne peut PAS UPDATE un client du tenant_b (0 rows affectées)'
);


SELECT * FROM finish();
ROLLBACK;
