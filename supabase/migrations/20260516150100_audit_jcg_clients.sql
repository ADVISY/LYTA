-- READ-ONLY : audit des 931 clients de JCG après son import de 1000 contacts
DO $$
DECLARE
  r RECORD;
  v_jcg UUID := '7af2904e-a965-443b-9e21-7b7136cc0eaa'::uuid;
  v_total INT;
  v_no_name INT;
  v_no_email INT;
  v_no_phone INT;
  v_no_address INT;
  v_dup_email INT;
  v_dup_name INT;
  v_with_agent INT;
  v_no_agent INT;
  v_today INT;
  v_yesterday INT;
  v_week INT;
BEGIN
  SELECT count(*) INTO v_total FROM public.clients WHERE tenant_id = v_jcg;
  SELECT count(*) INTO v_no_name FROM public.clients WHERE tenant_id = v_jcg
    AND (COALESCE(first_name, '') = '' OR first_name IS NULL)
    AND (COALESCE(last_name, '') = '' OR last_name IS NULL)
    AND (COALESCE(company_name, '') = '' OR company_name IS NULL);
  SELECT count(*) INTO v_no_email FROM public.clients WHERE tenant_id = v_jcg
    AND (COALESCE(email, '') = '' OR email IS NULL);
  SELECT count(*) INTO v_no_phone FROM public.clients WHERE tenant_id = v_jcg
    AND (COALESCE(phone, '') = '' OR phone IS NULL);
  SELECT count(*) INTO v_no_address FROM public.clients WHERE tenant_id = v_jcg
    AND (COALESCE(address, '') = '' OR address IS NULL);
  SELECT count(*) INTO v_with_agent FROM public.clients WHERE tenant_id = v_jcg AND assigned_agent_id IS NOT NULL;
  SELECT count(*) INTO v_no_agent FROM public.clients WHERE tenant_id = v_jcg AND assigned_agent_id IS NULL;

  -- Doublons emails
  SELECT count(*) INTO v_dup_email FROM (
    SELECT lower(email) FROM public.clients WHERE tenant_id = v_jcg AND email IS NOT NULL AND email <> ''
    GROUP BY lower(email) HAVING count(*) > 1
  ) sub;

  -- Doublons nom+prenom
  SELECT count(*) INTO v_dup_name FROM (
    SELECT lower(COALESCE(first_name,'')) || '|' || lower(COALESCE(last_name,''))
    FROM public.clients WHERE tenant_id = v_jcg
    GROUP BY 1 HAVING count(*) > 1
  ) sub;

  -- Distribution par date de création
  SELECT count(*) INTO v_today FROM public.clients WHERE tenant_id = v_jcg
    AND created_at >= CURRENT_DATE;
  SELECT count(*) INTO v_yesterday FROM public.clients WHERE tenant_id = v_jcg
    AND created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE;
  SELECT count(*) INTO v_week FROM public.clients WHERE tenant_id = v_jcg
    AND created_at >= CURRENT_DATE - INTERVAL '7 days';

  RAISE NOTICE '';
  RAISE NOTICE '=== AUDIT CLIENTS JCG CONSULTING (tenant=%) ===', v_jcg;
  RAISE NOTICE '  Total                       : %', v_total;
  RAISE NOTICE '  Sans nom (1st+last+company) : % (%%%)', v_no_name, ROUND(100.0*v_no_name/NULLIF(v_total,0), 1);
  RAISE NOTICE '  Sans email                  : % (%%%)', v_no_email, ROUND(100.0*v_no_email/NULLIF(v_total,0), 1);
  RAISE NOTICE '  Sans téléphone              : % (%%%)', v_no_phone, ROUND(100.0*v_no_phone/NULLIF(v_total,0), 1);
  RAISE NOTICE '  Sans adresse                : % (%%%)', v_no_address, ROUND(100.0*v_no_address/NULLIF(v_total,0), 1);
  RAISE NOTICE '  Avec agent assigné          : %', v_with_agent;
  RAISE NOTICE '  Sans agent assigné          : %', v_no_agent;
  RAISE NOTICE '  Doublons emails             : % groupe(s)', v_dup_email;
  RAISE NOTICE '  Doublons nom+prenom         : % groupe(s)', v_dup_name;
  RAISE NOTICE '';
  RAISE NOTICE '=== DATES D''IMPORT ===';
  RAISE NOTICE '  Créés aujourd''hui          : %', v_today;
  RAISE NOTICE '  Créés hier                  : %', v_yesterday;
  RAISE NOTICE '  Créés cette semaine         : %', v_week;
  RAISE NOTICE '';
  RAISE NOTICE '=== TOP 10 DOUBLONS EMAILS ===';
  FOR r IN
    SELECT lower(email) AS em, count(*) AS cnt
    FROM public.clients
    WHERE tenant_id = v_jcg AND email IS NOT NULL AND email <> ''
    GROUP BY lower(email) HAVING count(*) > 1
    ORDER BY cnt DESC LIMIT 10
  LOOP
    RAISE NOTICE '  "%": %', r.em, r.cnt;
  END LOOP;
  RAISE NOTICE '';
  RAISE NOTICE '=== 5 CLIENTS LES PLUS RÉCENTS ===';
  FOR r IN
    SELECT id, created_at, first_name, last_name, company_name, email, phone, type_adresse, status
    FROM public.clients
    WHERE tenant_id = v_jcg
    ORDER BY created_at DESC LIMIT 5
  LOOP
    RAISE NOTICE '  % | "% %" / "%" | em=% | type=% | status=%',
      r.created_at,
      COALESCE(r.first_name, '∅'), COALESCE(r.last_name, '∅'),
      COALESCE(r.company_name, '∅'),
      COALESCE(r.email, '∅'),
      COALESCE(r.type_adresse, '∅'),
      COALESCE(r.status, '∅');
  END LOOP;
END $$;
