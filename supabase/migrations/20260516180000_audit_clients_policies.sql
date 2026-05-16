-- READ-ONLY : liste toutes les policies SELECT actives sur clients
DO $$
DECLARE r RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== POLICIES sur public.clients ===';
  FOR r IN
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clients'
    ORDER BY cmd, policyname
  LOOP
    RAISE NOTICE '  [%] %', r.cmd, r.policyname;
    RAISE NOTICE '       USING: %', LEFT(r.qual, 200);
  END LOOP;
END $$;
