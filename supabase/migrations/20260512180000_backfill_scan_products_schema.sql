-- ============================================================================
-- Backfill existing scans: normalise legacy French-prefixed product fields
-- ============================================================================
-- Earlier scans were stored with mixed field names because the LLM sometimes
-- emitted "nouvelle_compagnie" / "nouveau_type_produit" / "nouvelle_prime_mensuelle"
-- instead of the canonical schema (company / product_name / premium_monthly).
-- The Edge function now normalises on-the-fly, but rows already in the DB
-- still carry the legacy keys. This backfill rewrites them so the wizard
-- can read those scans without forcing the broker to re-upload everything.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._scan_normalise_product(p JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  result JSONB := p;
  amount_text TEXT;
  amount_num NUMERIC;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RETURN p;
  END IF;

  -- product_name ← nouveau_type_produit | type_produit | name
  IF result ? 'product_name' = false OR result->>'product_name' IS NULL THEN
    result := result || jsonb_build_object('product_name',
      COALESCE(p->>'nouveau_type_produit', p->>'ancien_type_produit', p->>'type_produit', p->>'name'));
  END IF;

  -- company ← nouvelle_compagnie | ancienne_compagnie | compagnie
  IF result ? 'company' = false OR result->>'company' IS NULL THEN
    result := result || jsonb_build_object('company',
      COALESCE(p->>'nouvelle_compagnie', p->>'ancienne_compagnie', p->>'compagnie'));
  END IF;

  -- premium_monthly ← nouvelle_prime_mensuelle (parse string with CHF / commas)
  IF result ? 'premium_monthly' = false OR result->>'premium_monthly' IS NULL THEN
    amount_text := COALESCE(p->>'nouvelle_prime_mensuelle', p->>'ancienne_prime_mensuelle', p->>'prime_mensuelle');
    IF amount_text IS NOT NULL THEN
      amount_text := regexp_replace(amount_text, '[^\d.,-]', '', 'g');
      amount_text := replace(amount_text, ',', '.');
      BEGIN
        amount_num := amount_text::numeric;
        result := result || jsonb_build_object('premium_monthly', amount_num);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  -- premium_yearly
  IF result ? 'premium_yearly' = false OR result->>'premium_yearly' IS NULL THEN
    amount_text := COALESCE(p->>'nouvelle_prime_annuelle', p->>'ancienne_prime_annuelle', p->>'prime_annuelle');
    IF amount_text IS NOT NULL THEN
      amount_text := regexp_replace(amount_text, '[^\d.,-]', '', 'g');
      amount_text := replace(amount_text, ',', '.');
      BEGIN
        amount_num := amount_text::numeric;
        result := result || jsonb_build_object('premium_yearly', amount_num);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  -- franchise
  IF result ? 'franchise' = false OR result->>'franchise' IS NULL THEN
    amount_text := COALESCE(p->>'nouvelle_franchise', p->>'ancienne_franchise', p->>'franchise_annuelle');
    IF amount_text IS NOT NULL THEN
      amount_text := regexp_replace(amount_text, '[^\d.,-]', '', 'g');
      amount_text := replace(amount_text, ',', '.');
      BEGIN
        amount_num := amount_text::numeric;
        result := result || jsonb_build_object('franchise', amount_num);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  -- start_date
  IF result ? 'start_date' = false OR result->>'start_date' IS NULL THEN
    result := result || jsonb_build_object('start_date',
      COALESCE(p->>'nouvelle_date_debut', p->>'ancienne_date_debut', p->>'date_debut'));
  END IF;

  -- end_date
  IF result ? 'end_date' = false OR result->>'end_date' IS NULL THEN
    result := result || jsonb_build_object('end_date',
      COALESCE(p->>'nouvelle_date_de_fin', p->>'nouvelle_date_fin',
               p->>'ancienne_date_de_fin', p->>'ancienne_date_fin',
               p->>'date_de_fin', p->>'date_fin'));
  END IF;

  -- policy_number
  IF result ? 'policy_number' = false OR result->>'policy_number' IS NULL THEN
    result := result || jsonb_build_object('policy_number',
      COALESCE(p->>'nouveau_numero_police', p->>'ancien_numero_police', p->>'numero_police'));
  END IF;

  RETURN result;
END;
$$;

-- Backfill: rewrite new_products_detected + old_products_detected with normalised entries.
UPDATE public.document_scans
SET
  new_products_detected = COALESCE((
    SELECT jsonb_agg(public._scan_normalise_product(elem))
    FROM jsonb_array_elements(new_products_detected) AS elem
  ), '[]'::jsonb),
  old_products_detected = COALESCE((
    SELECT jsonb_agg(public._scan_normalise_product(elem))
    FROM jsonb_array_elements(old_products_detected) AS elem
  ), '[]'::jsonb)
WHERE jsonb_array_length(new_products_detected) > 0
   OR jsonb_array_length(old_products_detected) > 0;

-- Helper function only needed during backfill; drop it to keep schema clean
DROP FUNCTION public._scan_normalise_product(JSONB);
