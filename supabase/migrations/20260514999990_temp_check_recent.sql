DO $$
DECLARE
  v_tenant_id UUID;
  v_scan RECORD;
  v_client RECORD;
  v_fm RECORD;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'advisy';

  -- Last scan content
  RAISE NOTICE '=== DERNIER SCAN ===';
  FOR v_scan IN
    SELECT id, created_at, status, ai_model_used,
           jsonb_array_length(new_products_detected) AS np,
           jsonb_array_length(family_members_detected) AS fm,
           primary_holder, new_products_detected, family_members_detected
    FROM public.document_scans
    WHERE tenant_id = v_tenant_id
    ORDER BY created_at DESC
    LIMIT 1
  LOOP
    RAISE NOTICE 'Scan: % (status=%, model=%)', v_scan.id, v_scan.status, v_scan.ai_model_used;
    RAISE NOTICE 'primary_holder: %', v_scan.primary_holder::text;
    RAISE NOTICE 'family count: % | new_products count: %', v_scan.fm, v_scan.np;
    RAISE NOTICE 'family: %', LEFT(v_scan.family_members_detected::text, 800);
    RAISE NOTICE 'products (insured_person info): %', LEFT(v_scan.new_products_detected::text, 1500);
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== 5 DERNIERS CLIENTS ADVISY ===';
  FOR v_client IN
    SELECT id, created_at, first_name, last_name, email, birthdate, gender, status
    FROM public.clients
    WHERE tenant_id = v_tenant_id
    ORDER BY created_at DESC
    LIMIT 5
  LOOP
    RAISE NOTICE '  - % % % | dob=% gender=% email=% status=%',
      v_client.id, COALESCE(v_client.first_name, '(null)'), COALESCE(v_client.last_name, '(null)'),
      COALESCE(v_client.birthdate::text, '-'), COALESCE(v_client.gender, '-'),
      COALESCE(v_client.email, '-'), v_client.status;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== 10 DERNIERS family_members ADVISY ===';
  FOR v_fm IN
    SELECT fm.created_at, fm.client_id, fm.linked_client_id, fm.first_name, fm.last_name, fm.relation_type,
           c.first_name AS owner_first, c.last_name AS owner_last
    FROM public.family_members fm
    JOIN public.clients c ON c.id = fm.client_id
    WHERE c.tenant_id = v_tenant_id
    ORDER BY fm.created_at DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '  - "% %" lié à client "% %" (relation=%, linked_client=%)',
      COALESCE(v_fm.first_name, '?'), COALESCE(v_fm.last_name, '?'),
      COALESCE(v_fm.owner_first, '?'), COALESCE(v_fm.owner_last, '?'),
      v_fm.relation_type,
      COALESCE(v_fm.linked_client_id::text, '(none)');
  END LOOP;
END;
$$;
