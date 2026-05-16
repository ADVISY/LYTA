-- READ-ONLY : breakdown status pour clients de JCG (type=client)
DO $$
DECLARE
  r RECORD;
  v_jcg UUID := '7af2904e-a965-443b-9e21-7b7136cc0eaa'::uuid;
  v_client_total INT;
BEGIN
  SELECT count(*) INTO v_client_total FROM public.clients
  WHERE tenant_id = v_jcg AND type_adresse = 'client';

  RAISE NOTICE '';
  RAISE NOTICE '=== TYPE_ADRESSE=client → breakdown STATUS ===';
  RAISE NOTICE '  Total type=client : %', v_client_total;
  RAISE NOTICE '';
  FOR r IN
    SELECT COALESCE(status, '(NULL)') AS s, count(*) AS cnt
    FROM public.clients
    WHERE tenant_id = v_jcg AND type_adresse = 'client'
    GROUP BY status
    ORDER BY cnt DESC
  LOOP
    RAISE NOTICE '  status=% : %', r.s, r.cnt;
  END LOOP;
END $$;
