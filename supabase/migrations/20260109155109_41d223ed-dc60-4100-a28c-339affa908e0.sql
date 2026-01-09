-- Table pour stocker les codes de vérification SMS
CREATE TABLE public.sms_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    code TEXT NOT NULL,
    verification_type TEXT NOT NULL DEFAULT 'login', -- 'login', 'contract_deposit'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX idx_sms_verifications_user ON public.sms_verifications(user_id, verification_type);
CREATE INDEX idx_sms_verifications_code ON public.sms_verifications(code, expires_at);

-- Enable RLS
ALTER TABLE public.sms_verifications ENABLE ROW LEVEL SECURITY;

-- Policies - only the user themselves can see their own verifications
CREATE POLICY "Users can view own verifications"
ON public.sms_verifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role can insert/update (edge functions)
CREATE POLICY "Service role can manage verifications"
ON public.sms_verifications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Function to check if user requires SMS verification
CREATE OR REPLACE FUNCTION public.requires_sms_verification(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND role IN ('king', 'admin')
  )
$$;

-- Function to generate a 6-digit code
CREATE OR REPLACE FUNCTION public.generate_verification_code()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0')
$$;

-- Cleanup old verifications (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_verifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sms_verifications 
  WHERE expires_at < now() - interval '1 hour';
END;
$$;