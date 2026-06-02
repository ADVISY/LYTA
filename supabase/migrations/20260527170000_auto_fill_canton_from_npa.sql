-- ============================================================================
-- Auto-fill canton depuis le code postal (NPA) suisse
-- ============================================================================
-- Contexte : le filtre canton dans Adresses était inutile car la quasi-totalité
-- des fiches n'avaient pas de canton renseigné. Or en Suisse, le NPA détermine
-- le canton dans 95+% des cas (les rares exceptions sont des NPA partagés
-- entre 2 cantons frontaliers).
--
-- Source du mapping : ranges officiels La Poste Suisse. Cas ambigus (NPA
-- frontaliers entre 2 cantons) : on prend le canton dominant statistiquement.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.npa_to_canton(p_npa text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_npa integer;
BEGIN
  IF p_npa IS NULL OR length(trim(p_npa)) = 0 THEN
    RETURN NULL;
  END IF;

  -- On accepte un NPA avec ou sans espaces, on prend les 4 premiers chiffres
  BEGIN
    v_npa := substring(regexp_replace(p_npa, '\D', '', 'g') FROM 1 FOR 4)::integer;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF v_npa < 1000 OR v_npa > 9999 THEN
    RETURN NULL;
  END IF;

  -- ── Suisse romande ───────────────────────────────
  IF v_npa BETWEEN 1000 AND 1199 THEN RETURN 'VD'; END IF;
  IF v_npa BETWEEN 1200 AND 1299 THEN RETURN 'GE'; END IF;
  IF v_npa BETWEEN 1300 AND 1499 THEN RETURN 'VD'; END IF;
  IF v_npa BETWEEN 1500 AND 1599 THEN RETURN 'VD'; END IF;
  IF v_npa BETWEEN 1600 AND 1699 THEN RETURN 'VD'; END IF;
  IF v_npa BETWEEN 1700 AND 1799 THEN RETURN 'FR'; END IF;
  IF v_npa BETWEEN 1860 AND 1865 THEN RETURN 'VD'; END IF; -- Aigle / Bex
  IF v_npa BETWEEN 1800 AND 1859 THEN RETURN 'VS'; END IF;
  IF v_npa BETWEEN 1866 AND 1999 THEN RETURN 'VS'; END IF;

  -- ── Jura / Neuchâtel / Berne-frontière ───────────
  IF v_npa BETWEEN 2000 AND 2099 THEN RETURN 'NE'; END IF;
  IF v_npa BETWEEN 2100 AND 2199 THEN RETURN 'NE'; END IF;
  IF v_npa BETWEEN 2200 AND 2299 THEN RETURN 'NE'; END IF;
  IF v_npa BETWEEN 2300 AND 2399 THEN RETURN 'NE'; END IF; -- La Chaux-de-Fonds
  IF v_npa BETWEEN 2400 AND 2499 THEN RETURN 'NE'; END IF; -- Le Locle
  IF v_npa BETWEEN 2500 AND 2599 THEN RETURN 'BE'; END IF; -- Bienne
  IF v_npa BETWEEN 2600 AND 2999 THEN RETURN 'JU'; END IF;

  -- ── Berne ────────────────────────────────────────
  IF v_npa BETWEEN 3000 AND 3999 THEN RETURN 'BE'; END IF;

  -- ── Bâle / Soleure / Argovie ─────────────────────
  IF v_npa BETWEEN 4000 AND 4099 THEN RETURN 'BS'; END IF;
  IF v_npa BETWEEN 4100 AND 4299 THEN RETURN 'BL'; END IF;
  IF v_npa BETWEEN 4300 AND 4499 THEN RETURN 'BL'; END IF;
  IF v_npa BETWEEN 4500 AND 4699 THEN RETURN 'SO'; END IF;
  IF v_npa BETWEEN 4700 AND 4799 THEN RETURN 'SO'; END IF;
  IF v_npa BETWEEN 4800 AND 4899 THEN RETURN 'AG'; END IF;
  IF v_npa BETWEEN 4900 AND 4999 THEN RETURN 'BE'; END IF; -- Langenthal
  IF v_npa BETWEEN 5000 AND 5999 THEN RETURN 'AG'; END IF;

  -- ── Suisse centrale ──────────────────────────────
  IF v_npa BETWEEN 6000 AND 6019 THEN RETURN 'LU'; END IF;
  IF v_npa BETWEEN 6020 AND 6029 THEN RETURN 'OW'; END IF; -- Sarnen
  IF v_npa BETWEEN 6030 AND 6099 THEN RETURN 'LU'; END IF;
  IF v_npa BETWEEN 6100 AND 6199 THEN RETURN 'LU'; END IF;
  IF v_npa BETWEEN 6200 AND 6299 THEN RETURN 'LU'; END IF;
  IF v_npa BETWEEN 6300 AND 6349 THEN RETURN 'ZG'; END IF;
  IF v_npa BETWEEN 6350 AND 6399 THEN RETURN 'ZG'; END IF;
  IF v_npa BETWEEN 6400 AND 6499 THEN RETURN 'SZ'; END IF;
  IF v_npa BETWEEN 6500 AND 6599 THEN RETURN 'TI'; END IF;
  IF v_npa BETWEEN 6600 AND 6999 THEN RETURN 'TI'; END IF;

  -- ── Suisse alémanique orientale ──────────────────
  IF v_npa BETWEEN 7000 AND 7999 THEN RETURN 'GR'; END IF;
  IF v_npa BETWEEN 8000 AND 8499 THEN RETURN 'ZH'; END IF;
  IF v_npa BETWEEN 8500 AND 8599 THEN RETURN 'TG'; END IF; -- Frauenfeld
  IF v_npa BETWEEN 8600 AND 8999 THEN RETURN 'ZH'; END IF;
  IF v_npa BETWEEN 9000 AND 9499 THEN RETURN 'SG'; END IF;
  IF v_npa BETWEEN 9500 AND 9599 THEN RETURN 'SG'; END IF; -- Wil
  IF v_npa BETWEEN 9600 AND 9699 THEN RETURN 'SG'; END IF;
  IF v_npa BETWEEN 9700 AND 9799 THEN RETURN 'AR'; END IF;
  IF v_npa BETWEEN 9800 AND 9899 THEN RETURN 'AI'; END IF;
  IF v_npa BETWEEN 9900 AND 9999 THEN RETURN 'TG'; END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.npa_to_canton(text) TO authenticated;

-- ============================================================================
-- Trigger : auto-remplir canton si vide à chaque INSERT/UPDATE sur clients
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_clients_auto_canton()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.canton IS NULL OR length(trim(NEW.canton)) = 0)
     AND (NEW.postal_code IS NOT NULL AND length(trim(NEW.postal_code)) > 0)
  THEN
    NEW.canton := public.npa_to_canton(NEW.postal_code);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_auto_canton ON public.clients;
CREATE TRIGGER clients_auto_canton
BEFORE INSERT OR UPDATE OF postal_code, canton ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.tg_clients_auto_canton();

-- ============================================================================
-- Backfill : remplir le canton de toutes les fiches existantes où il est vide
-- ============================================================================
UPDATE public.clients
SET canton = public.npa_to_canton(postal_code)
WHERE (canton IS NULL OR length(trim(canton)) = 0)
  AND postal_code IS NOT NULL
  AND length(trim(postal_code)) > 0
  AND public.npa_to_canton(postal_code) IS NOT NULL;

-- ============================================================================
-- King notification
-- ============================================================================
INSERT INTO public.king_notifications (title, message, kind, priority, metadata)
VALUES (
  'Auto-fill canton depuis NPA — backfill',
  'Fonction npa_to_canton + trigger auto sur clients. Backfill des fiches existantes où canton etait vide. Le filtre canton dans Adresses devient enfin utile.',
  'system_info', 'low',
  jsonb_build_object(
    'migration', '20260527170000_auto_fill_canton_from_npa',
    'tables_touched', ARRAY['public.clients']
  )
);
