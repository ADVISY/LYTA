-- ============================================================================
-- Fixtures pgTAP — 2 tenants + 4 users pour tests cross-tenant
-- ============================================================================
-- Chaque test.sql doit `\i _fixtures.sql` en début de transaction. Les
-- inserts se font en service_role pour bypass RLS et poser un état propre.
--
-- Tenants créés :
--   · tenant_a  = 'aaaa1111-1111-1111-1111-111111111111'
--   · tenant_b  = 'bbbb2222-2222-2222-2222-222222222222'
--
-- Users créés (auth.users) :
--   · admin_a   = '11111111-aaaa-1111-1111-aaaaaaaaaaaa' → tenant_a, role admin
--   · agent_a   = '22222222-aaaa-1111-1111-aaaaaaaaaaaa' → tenant_a, role agent
--   · admin_b   = '33333333-bbbb-2222-2222-bbbbbbbbbbbb' → tenant_b, role admin
--   · client_b  = '44444444-bbbb-2222-2222-bbbbbbbbbbbb' → tenant_b, role client
--
-- Clients (fiches) créés :
--   · client_1_a = '55555555-a1a1-1111-1111-111111111111' → dans tenant_a
--   · client_2_b = '66666666-b2b2-2222-2222-222222222222' → dans tenant_b
--
-- IMPORTANT : ces UUIDs sont statiques pour que les tests soient
-- déterministes. Chaque test.sql qui utilise ces fixtures les réf par ces
-- UUIDs.
-- ============================================================================

SET LOCAL role = service_role;

-- Tenants ────────────────────────────────────────────────────────────────
INSERT INTO public.tenants (id, name, slug, status, tenant_status, payment_status, admin_email, phone)
VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'Cabinet A Test', 'cabinet-a-test', 'active', 'active', 'active', 'admin.a@test.local', '+41791110001'),
  ('bbbb2222-2222-2222-2222-222222222222', 'Cabinet B Test', 'cabinet-b-test', 'active', 'active', 'active', 'admin.b@test.local', '+41791110002')
ON CONFLICT (id) DO NOTHING;

-- Auth users ─────────────────────────────────────────────────────────────
-- Insertion directe (dev/test only). En prod jamais.
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, raw_user_meta_data)
VALUES
  ('11111111-aaaa-1111-1111-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'admin.a@test.local', '', now(), 'authenticated', 'authenticated', '{}'::jsonb),
  ('22222222-aaaa-1111-1111-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'agent.a@test.local', '', now(), 'authenticated', 'authenticated', '{}'::jsonb),
  ('33333333-bbbb-2222-2222-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'admin.b@test.local', '', now(), 'authenticated', 'authenticated', '{}'::jsonb),
  ('44444444-bbbb-2222-2222-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'client.b@test.local', '', now(), 'authenticated', 'authenticated', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Profiles ──────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, email, first_name, last_name, phone)
VALUES
  ('11111111-aaaa-1111-1111-aaaaaaaaaaaa', 'admin.a@test.local', 'Admin', 'A', '+41791110011'),
  ('22222222-aaaa-1111-1111-aaaaaaaaaaaa', 'agent.a@test.local', 'Agent', 'A', '+41791110022'),
  ('33333333-bbbb-2222-2222-bbbbbbbbbbbb', 'admin.b@test.local', 'Admin', 'B', '+41791110033'),
  ('44444444-bbbb-2222-2222-bbbbbbbbbbbb', 'client.b@test.local', 'Client', 'B', '+41791110044')
ON CONFLICT (id) DO NOTHING;

-- User roles (rôle plateforme) ──────────────────────────────────────────
INSERT INTO public.user_roles (user_id, role)
VALUES
  ('11111111-aaaa-1111-1111-aaaaaaaaaaaa', 'admin'),
  ('22222222-aaaa-1111-1111-aaaaaaaaaaaa', 'agent'),
  ('33333333-bbbb-2222-2222-bbbbbbbbbbbb', 'admin'),
  ('44444444-bbbb-2222-2222-bbbbbbbbbbbb', 'client')
ON CONFLICT (user_id, role) DO NOTHING;

-- User → tenant assignments ────────────────────────────────────────────
INSERT INTO public.user_tenant_assignments (user_id, tenant_id)
VALUES
  ('11111111-aaaa-1111-1111-aaaaaaaaaaaa', 'aaaa1111-1111-1111-1111-111111111111'),
  ('22222222-aaaa-1111-1111-aaaaaaaaaaaa', 'aaaa1111-1111-1111-1111-111111111111'),
  ('33333333-bbbb-2222-2222-bbbbbbbbbbbb', 'bbbb2222-2222-2222-2222-222222222222'),
  ('44444444-bbbb-2222-2222-bbbbbbbbbbbb', 'bbbb2222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- Clients (fiches) ─────────────────────────────────────────────────────
INSERT INTO public.clients (id, tenant_id, first_name, last_name, email, type_adresse, status, is_company)
VALUES
  ('55555555-a1a1-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'Jean', 'Client A', 'jean.a@test.local', 'client', 'client', false),
  ('66666666-b2b2-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 'Marie', 'Client B', 'marie.b@test.local', 'client', 'client', false)
ON CONFLICT (id) DO NOTHING;

-- Link client_b user to their client record (portail /espace-client)
UPDATE public.clients
SET user_id = '44444444-bbbb-2222-2222-bbbbbbbbbbbb'
WHERE id = '66666666-b2b2-2222-2222-222222222222';
