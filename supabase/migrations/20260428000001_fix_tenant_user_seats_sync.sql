-- Keep KING user limits and tenant subscription seats aligned.
-- Account creation and CRM UI both use get_tenant_seat_summary.

WITH audited_user_limits AS (
  SELECT DISTINCT tenant_id
  FROM public.tenant_limits_audit
  WHERE limit_type IN ('users_limit', 'users')
)
UPDATE public.tenants t
SET
  extra_users = GREATEST(0, tl.users_limit - COALESCE(t.seats_included, 1)),
  updated_at = now()
FROM public.tenant_limits tl
JOIN audited_user_limits a ON a.tenant_id = tl.tenant_id
WHERE t.id = tl.tenant_id
  AND (COALESCE(t.seats_included, 1) + COALESCE(t.extra_users, 0)) IS DISTINCT FROM tl.users_limit;

UPDATE public.tenant_limits tl
SET
  users_limit = COALESCE(t.seats_included, 1) + COALESCE(t.extra_users, 0),
  updated_at = now()
FROM public.tenants t
WHERE tl.tenant_id = t.id
  AND NOT EXISTS (
    SELECT 1
    FROM public.tenant_limits_audit tla
    WHERE tla.tenant_id = tl.tenant_id
      AND tla.limit_type IN ('users_limit', 'users')
  )
  AND tl.users_limit IS DISTINCT FROM (COALESCE(t.seats_included, 1) + COALESCE(t.extra_users, 0));

CREATE OR REPLACE FUNCTION public.sync_tenant_limits_users_limit_from_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_seats INTEGER;
BEGIN
  v_total_seats := GREATEST(0, COALESCE(NEW.seats_included, 1) + COALESCE(NEW.extra_users, 0));

  INSERT INTO public.tenant_limits (tenant_id, users_limit)
  VALUES (NEW.id, v_total_seats)
  ON CONFLICT (tenant_id) DO UPDATE
  SET
    users_limit = EXCLUDED.users_limit,
    updated_at = now()
  WHERE public.tenant_limits.users_limit IS DISTINCT FROM EXCLUDED.users_limit;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tenant_limits_users_limit_from_tenant ON public.tenants;

CREATE TRIGGER trg_sync_tenant_limits_users_limit_from_tenant
AFTER INSERT OR UPDATE OF seats_included, extra_users ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.sync_tenant_limits_users_limit_from_tenant();

CREATE OR REPLACE FUNCTION public.sync_tenant_extra_users_from_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seats_included INTEGER;
  v_extra_users INTEGER;
BEGIN
  SELECT COALESCE(seats_included, 1)
  INTO v_seats_included
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  IF v_seats_included IS NULL THEN
    RETURN NEW;
  END IF;

  v_extra_users := GREATEST(0, COALESCE(NEW.users_limit, v_seats_included) - v_seats_included);

  UPDATE public.tenants
  SET
    extra_users = v_extra_users,
    updated_at = now()
  WHERE id = NEW.tenant_id
    AND COALESCE(extra_users, 0) IS DISTINCT FROM v_extra_users;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tenant_extra_users_from_limits ON public.tenant_limits;

CREATE TRIGGER trg_sync_tenant_extra_users_from_limits
AFTER UPDATE OF users_limit ON public.tenant_limits
FOR EACH ROW
WHEN (OLD.users_limit IS DISTINCT FROM NEW.users_limit)
EXECUTE FUNCTION public.sync_tenant_extra_users_from_limits();

CREATE OR REPLACE FUNCTION public.get_tenant_seat_summary(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  tenant_id UUID,
  seats_included INTEGER,
  extra_users INTEGER,
  total_seats INTEGER,
  active_users INTEGER,
  available_seats INTEGER,
  seat_price NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(p_tenant_id, public.get_user_tenant_id());

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.is_king()
     AND NOT EXISTS (
       SELECT 1
       FROM public.user_tenant_assignments uta
       WHERE uta.user_id = auth.uid()
         AND uta.tenant_id = v_tenant_id
     ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH tenant_row AS (
    SELECT
      t.id,
      COALESCE(t.seats_included, 1)::INTEGER AS seats_included,
      COALESCE(t.extra_users, 0)::INTEGER AS extra_users,
      COALESCE(t.seats_price, 20)::NUMERIC AS seat_price
    FROM public.tenants t
    WHERE t.id = v_tenant_id
  ),
  limit_row AS (
    SELECT
      tl.users_limit,
      EXISTS (
        SELECT 1
        FROM public.tenant_limits_audit tla
        WHERE tla.tenant_id = tl.tenant_id
          AND tla.limit_type IN ('users_limit', 'users')
      ) AS has_user_limit_override
    FROM public.tenant_limits tl
    WHERE tl.tenant_id = v_tenant_id
  ),
  capacity AS (
    SELECT
      tr.id,
      tr.seats_included,
      CASE
        WHEN COALESCE(lr.has_user_limit_override, false)
          THEN GREATEST(COALESCE(lr.users_limit, tr.seats_included + tr.extra_users), tr.seats_included)
        ELSE tr.seats_included + tr.extra_users
      END::INTEGER AS total_seats,
      tr.seat_price
    FROM tenant_row tr
    LEFT JOIN limit_row lr ON true
  ),
  billable_users AS (
    SELECT COUNT(DISTINCT uta.user_id)::INTEGER AS count
    FROM public.user_tenant_assignments uta
    WHERE uta.tenant_id = v_tenant_id
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = uta.user_id
          AND ur.role <> 'client'
      )
  )
  SELECT
    c.id AS tenant_id,
    c.seats_included,
    GREATEST(0, c.total_seats - c.seats_included)::INTEGER AS extra_users,
    c.total_seats,
    COALESCE(b.count, 0)::INTEGER AS active_users,
    (c.total_seats - COALESCE(b.count, 0))::INTEGER AS available_seats,
    c.seat_price
  FROM capacity c
  CROSS JOIN billable_users b;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_seat_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_seat_summary(UUID) TO service_role;
