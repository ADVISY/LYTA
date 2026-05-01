-- One-off cleanup requested by JCG Consulting:
-- remove user accounts linked to Mathieu/Matthieu and Julien while keeping
-- their collaborator rows so the tenant can recreate the accounts manually.

DO $$
DECLARE
  v_tenant_id uuid;
  v_target_count integer;
  v_target_user_count integer;
  v_deleted_auth_count integer;
  r record;
BEGIN
  SELECT id
  INTO v_tenant_id
  FROM public.tenants
  WHERE slug = 'jcgconsulting'
     OR id = '7af2904e-a965-443b-9e21-7b7136cc0eaa'::uuid
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant jcgconsulting not found';
  END IF;

  CREATE TEMP TABLE _jcg_target_collaborators ON COMMIT DROP AS
  SELECT
    c.id AS client_id,
    c.user_id,
    lower(trim(c.email)) AS email,
    c.first_name,
    c.last_name
  FROM public.clients c
  WHERE c.tenant_id = v_tenant_id
    AND c.type_adresse = 'collaborateur'
    AND lower(trim(coalesce(c.first_name, ''))) IN ('mathieu', 'matthieu', 'julien');

  GET DIAGNOSTICS v_target_count = ROW_COUNT;

  CREATE TEMP TABLE _jcg_target_users ON COMMIT DROP AS
  SELECT DISTINCT user_id
  FROM _jcg_target_collaborators
  WHERE user_id IS NOT NULL
  UNION
  SELECT DISTINCT au.id AS user_id
  FROM auth.users au
  JOIN _jcg_target_collaborators tc ON lower(trim(au.email)) = tc.email
  WHERE tc.email IS NOT NULL;

  SELECT count(*) INTO v_target_user_count FROM _jcg_target_users;

  -- Only delete the auth user entirely when it is not linked to another tenant.
  CREATE TEMP TABLE _jcg_auth_users_to_delete ON COMMIT DROP AS
  SELECT tu.user_id
  FROM _jcg_target_users tu
  WHERE NOT EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.user_id = tu.user_id
        AND c.tenant_id <> v_tenant_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_tenant_assignments uta
      WHERE uta.user_id = tu.user_id
        AND uta.tenant_id IS DISTINCT FROM v_tenant_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_tenant_roles utr
      WHERE utr.user_id = tu.user_id
        AND utr.tenant_id <> v_tenant_id
    );

  -- Unlink the collaborator records but keep the rows.
  UPDATE public.clients c
  SET user_id = NULL
  WHERE c.id IN (SELECT client_id FROM _jcg_target_collaborators);

  -- Remove the tenant-scoped access for all matched users.
  DELETE FROM public.user_tenant_roles utr
  WHERE utr.user_id IN (SELECT user_id FROM _jcg_target_users)
    AND utr.tenant_id = v_tenant_id;

  DELETE FROM public.user_tenant_assignments uta
  WHERE uta.user_id IN (SELECT user_id FROM _jcg_target_users)
    AND uta.tenant_id = v_tenant_id;

  -- Clear nullable, non-cascading FK references to auth.users before deleting.
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      cl.relname AS table_name,
      a.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'auth.users'::regclass
      AND array_length(con.conkey, 1) = 1
      AND con.confdeltype NOT IN ('c', 'n')
      AND a.attnotnull = false
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = NULL WHERE %I IN (SELECT user_id FROM pg_temp._jcg_auth_users_to_delete)',
      r.schema_name,
      r.table_name,
      r.column_name,
      r.column_name
    );
  END LOOP;

  DELETE FROM auth.users au
  WHERE au.id IN (SELECT user_id FROM _jcg_auth_users_to_delete);

  GET DIAGNOSTICS v_deleted_auth_count = ROW_COUNT;

  RAISE NOTICE
    'JCG cleanup done: matched_collaborators=%, matched_users=%, deleted_auth_users=%',
    v_target_count,
    v_target_user_count,
    v_deleted_auth_count;
END $$;
