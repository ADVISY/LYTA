-- ============================================================================
-- Diagnostic V1 (suite) — agrégation des verdicts pour lecture rapide
-- ============================================================================
-- Migration NON DESTRUCTIVE. Lit la dernière notif V1 et affiche
-- un résumé (count par verdict) via RAISE NOTICE — visible directement
-- dans la sortie de `supabase db push`. Pas besoin d'aller fouiller en DB.
-- ============================================================================

DO $$
DECLARE
  v_detail jsonb;
  v_total int;
  v_aucun int;
  v_role_global_seul int;
  v_tr_sans_perm int;
  v_platform_admin int;
  v_autre int;
  v_sample jsonb;
BEGIN
  -- Récupère la metadata de la dernière notif V1 rôles
  SELECT metadata -> 'users_detail'
  INTO v_detail
  FROM public.king_notifications
  WHERE metadata ->> 'lint_targeted' = 'V1_rls_42501_root_cause_roles_detail'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_detail IS NULL THEN
    RAISE NOTICE 'Pas de notif V1 trouvée. Faut d''abord pusher 20260612233000_diagnose_v1_roles_per_uta.';
    RETURN;
  END IF;

  v_total := jsonb_array_length(v_detail);

  SELECT
    count(*) FILTER (WHERE elem ->> 'verdict' = 'AUCUN_ROLE_NULLE_PART'),
    count(*) FILTER (WHERE elem ->> 'verdict' = 'ROLE_GLOBAL_SEUL_PAS_DE_TENANT_ROLE'),
    count(*) FILTER (WHERE elem ->> 'verdict' = 'TENANT_ROLE_SANS_PERM_CLIENTS_VIEW'),
    count(*) FILTER (WHERE elem ->> 'verdict' = 'PLATFORM_ADMIN_OK'),
    count(*) FILTER (WHERE elem ->> 'verdict' = 'AUTRE')
  INTO v_aucun, v_role_global_seul, v_tr_sans_perm, v_platform_admin, v_autre
  FROM jsonb_array_elements(v_detail) AS elem;

  -- Échantillon : 3 premières lignes brutes pour valider
  SELECT jsonb_agg(elem)
  INTO v_sample
  FROM (
    SELECT elem
    FROM jsonb_array_elements(v_detail) AS elem
    LIMIT 3
  ) s;

  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'V1 — RÉSUMÉ DES VERDICTS ROLES';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Total users UTA tenants actifs analysés : %', v_total;
  RAISE NOTICE '────────────────────────────────────────────────────────────';
  RAISE NOTICE '  AUCUN_ROLE_NULLE_PART                : %', v_aucun;
  RAISE NOTICE '  ROLE_GLOBAL_SEUL_PAS_DE_TENANT_ROLE  : %', v_role_global_seul;
  RAISE NOTICE '  TENANT_ROLE_SANS_PERM_CLIENTS_VIEW   : %', v_tr_sans_perm;
  RAISE NOTICE '  PLATFORM_ADMIN_OK                    : %', v_platform_admin;
  RAISE NOTICE '  AUTRE                                : %', v_autre;
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Échantillon 3 premières lignes : %', v_sample;
  RAISE NOTICE '════════════════════════════════════════════════════════════';

  -- Re-dump dans une notification dédiée pour archive
  INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
  VALUES (
    '📊 V1 — résumé verdicts (counts par catégorie)',
    format(
      'Total: %s. AUCUN_ROLE_NULLE_PART: %s. ROLE_GLOBAL_SEUL: %s. TENANT_ROLE_SANS_PERM: %s. PLATFORM_ADMIN: %s. AUTRE: %s.',
      v_total, v_aucun, v_role_global_seul, v_tr_sans_perm, v_platform_admin, v_autre
    ),
    'system_info',
    'high',
    jsonb_build_object(
      'lint_targeted', 'V1_rls_42501_summary',
      'counts', jsonb_build_object(
        'total', v_total,
        'AUCUN_ROLE_NULLE_PART', v_aucun,
        'ROLE_GLOBAL_SEUL_PAS_DE_TENANT_ROLE', v_role_global_seul,
        'TENANT_ROLE_SANS_PERM_CLIENTS_VIEW', v_tr_sans_perm,
        'PLATFORM_ADMIN_OK', v_platform_admin,
        'AUTRE', v_autre
      ),
      'sample_3_users', v_sample
    )
  );
END $$;
