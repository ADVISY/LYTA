-- READ-ONLY : pourquoi JCG voit 850 (17×50) au lieu de 931 ?
DO $$
DECLARE
  v_jcg UUID := '7af2904e-a965-443b-9e21-7b7136cc0eaa'::uuid;
  v_total INT;
  v_client INT;
  v_collab INT;
  v_partenaire INT;
  v_null INT;
  v_other INT;
  v_planned INT;
BEGIN
  SELECT count(*) INTO v_total FROM public.clients WHERE tenant_id = v_jcg;
  SELECT count(*) INTO v_client FROM public.clients WHERE tenant_id = v_jcg AND type_adresse = 'client';
  SELECT count(*) INTO v_collab FROM public.clients WHERE tenant_id = v_jcg AND type_adresse = 'collaborateur';
  SELECT count(*) INTO v_partenaire FROM public.clients WHERE tenant_id = v_jcg AND type_adresse = 'partenaire';
  SELECT count(*) INTO v_null FROM public.clients WHERE tenant_id = v_jcg AND type_adresse IS NULL;
  SELECT count(*) INTO v_other FROM public.clients WHERE tenant_id = v_jcg AND type_adresse IS NOT NULL
    AND type_adresse NOT IN ('client', 'collaborateur', 'partenaire');

  -- Estimation Postgres ("planned") après mon ANALYZE
  SELECT reltuples::int INTO v_planned FROM pg_class WHERE relname = 'clients';

  RAISE NOTICE '';
  RAISE NOTICE '=== CLIENTS JCG par type_adresse ===';
  RAISE NOTICE '  Total réel             : %', v_total;
  RAISE NOTICE '  type_adresse=client     : %  ← le front filtre là-dessus par défaut', v_client;
  RAISE NOTICE '  type_adresse=collaborateur: %', v_collab;
  RAISE NOTICE '  type_adresse=partenaire : %', v_partenaire;
  RAISE NOTICE '  type_adresse=NULL       : %  ← invisibles côté UI (filtrés out)', v_null;
  RAISE NOTICE '  type_adresse=autre      : %', v_other;
  RAISE NOTICE '';
  RAISE NOTICE '  Estimation Postgres "planned" (toutes tables clients) : %', v_planned;
END $$;
