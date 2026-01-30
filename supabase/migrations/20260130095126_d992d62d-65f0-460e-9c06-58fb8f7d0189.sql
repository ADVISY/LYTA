
-- Create trigger function to auto-update storage consumption
CREATE OR REPLACE FUNCTION public.update_tenant_storage_on_document_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_year INT := EXTRACT(YEAR FROM NOW())::INT;
  v_month INT := EXTRACT(MONTH FROM NOW())::INT;
  v_total_bytes BIGINT;
BEGIN
  -- Get the tenant_id from the affected row
  IF TG_OP = 'DELETE' THEN
    v_tenant_id := OLD.tenant_id;
  ELSE
    v_tenant_id := NEW.tenant_id;
  END IF;

  -- Skip if no tenant_id
  IF v_tenant_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Calculate total storage for this tenant
  SELECT COALESCE(SUM(size_bytes), 0) INTO v_total_bytes
  FROM documents
  WHERE tenant_id = v_tenant_id;

  -- Upsert the consumption record
  INSERT INTO tenant_consumption (tenant_id, period_year, period_month, storage_used_bytes, updated_at)
  VALUES (v_tenant_id, v_year, v_month, v_total_bytes, NOW())
  ON CONFLICT (tenant_id, period_year, period_month)
  DO UPDATE SET 
    storage_used_bytes = v_total_bytes,
    updated_at = NOW();

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create triggers on documents table
DROP TRIGGER IF EXISTS trg_update_storage_on_insert ON documents;
DROP TRIGGER IF EXISTS trg_update_storage_on_update ON documents;
DROP TRIGGER IF EXISTS trg_update_storage_on_delete ON documents;

CREATE TRIGGER trg_update_storage_on_insert
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_storage_on_document_change();

CREATE TRIGGER trg_update_storage_on_update
  AFTER UPDATE OF size_bytes, tenant_id ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_storage_on_document_change();

CREATE TRIGGER trg_update_storage_on_delete
  AFTER DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_storage_on_document_change();
