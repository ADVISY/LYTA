-- Platform-wide settings (key/value store for KING admins)
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "King can read settings" ON platform_settings;
DROP POLICY IF EXISTS "King can write settings" ON platform_settings;
CREATE POLICY "King can read settings" ON platform_settings
  FOR SELECT USING (public.is_king());
CREATE POLICY "King can write settings" ON platform_settings
  FOR ALL USING (public.is_king());

INSERT INTO platform_settings (key, value) VALUES
  ('king_2fa_required', 'false'),
  ('king_session_timeout_minutes', '30'),
  ('king_ip_whitelist_enabled', 'false'),
  ('king_audit_trail_enabled', 'true'),
  ('platform_sender_email', '"noreply@lyta.ch"'),
  ('platform_support_email', '"support@lyta.ch"'),
  ('platform_default_price', '299'),
  ('notification_new_client', 'true'),
  ('notification_suspended', 'true'),
  ('extra_user_price_id', '"price_1SmZtZF7ZITS358Au3FHsdBA"')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS king_ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address CIDR NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE king_ip_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "King can manage whitelist" ON king_ip_whitelist;
CREATE POLICY "King can manage whitelist" ON king_ip_whitelist
  FOR ALL USING (public.is_king());

CREATE OR REPLACE FUNCTION get_platform_setting(setting_key TEXT)
RETURNS JSONB AS $$
  SELECT value FROM platform_settings WHERE key = setting_key;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_ip_in_whitelist(check_ip TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM king_ip_whitelist
    WHERE check_ip::inet <<= ip_address
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
